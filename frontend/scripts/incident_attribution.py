#!/usr/bin/env python3
"""Graph-temporal incident attribution prototype.

This module is intentionally dependency-free so it can run in CI, incident
automation, or as a service worker job before the rest of the platform exists.

Run the demo:
    python3 frontend/scripts/incident_attribution.py
"""

from __future__ import annotations

import json
import math
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Iterable, Mapping, Optional, Sequence


class SignalKind(str, Enum):
    ERROR_RATE = "error_rate"
    LATENCY = "latency"
    ALERT = "alert"
    SATURATION = "saturation"


@dataclass(frozen=True)
class DeployEvent:
    deploy_id: str
    commit_hash: str
    pr: str
    service: str
    deployed_at: datetime
    metadata: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ObservabilitySignal:
    signal_id: str
    service: str
    timestamp: datetime
    kind: SignalKind
    severity: float
    description: str


@dataclass(frozen=True)
class Incident:
    incident_id: str
    started_at: datetime
    detected_at: datetime
    primary_service: str
    signals: Sequence[ObservabilitySignal]


@dataclass(frozen=True)
class ScoringConfig:
    max_delay_hours: float = 6.0
    clock_skew_minutes: float = 5.0
    unknown_prior: float = 0.15
    unknown_signal_likelihood_ratio: float = 1.8
    background_signal_probability: float = 0.08
    immediate_decay_hours: float = 0.8
    delayed_decay_hours: float = 4.0
    dependency_decay: float = 0.9
    caller_decay: float = 0.7
    undirected_decay: float = 0.45
    max_graph_depth: int = 4
    kind_weights: Mapping[SignalKind, float] = field(
        default_factory=lambda: {
            SignalKind.ERROR_RATE: 1.0,
            SignalKind.ALERT: 0.95,
            SignalKind.LATENCY: 0.75,
            SignalKind.SATURATION: 0.65,
        }
    )


@dataclass(frozen=True)
class GraphEvidence:
    relationship: str
    distance: Optional[int]
    factor: float


@dataclass(frozen=True)
class SignalContribution:
    signal_id: str
    signal_service: str
    signal_kind: str
    lag_hours: float
    temporal_factor: float
    graph_relationship: str
    graph_distance: Optional[int]
    graph_factor: float
    likelihood_ratio: float
    log_contribution: float

    def to_dict(self) -> dict[str, object]:
        return {
            "signal_id": self.signal_id,
            "signal_service": self.signal_service,
            "signal_kind": self.signal_kind,
            "lag_hours": round(self.lag_hours, 3),
            "temporal_factor": round(self.temporal_factor, 3),
            "graph_relationship": self.graph_relationship,
            "graph_distance": self.graph_distance,
            "graph_factor": round(self.graph_factor, 3),
            "likelihood_ratio": round(self.likelihood_ratio, 3),
            "log_contribution": round(self.log_contribution, 3),
        }


@dataclass(frozen=True)
class RankedCommit:
    deploy: DeployEvent
    confidence: float
    log_score: float
    evidence: Sequence[SignalContribution]

    def to_dict(self) -> dict[str, object]:
        return {
            "commit_hash": self.deploy.commit_hash,
            "pr": self.deploy.pr,
            "service": self.deploy.service,
            "deployed_at": self.deploy.deployed_at.isoformat(),
            "confidence": round(self.confidence, 4),
            "top_evidence": [
                item.to_dict()
                for item in sorted(
                    self.evidence,
                    key=lambda contribution: contribution.log_contribution,
                    reverse=True,
                )[:3]
            ],
        }


@dataclass(frozen=True)
class AttributionResult:
    incident_id: str
    ranked_commits: Sequence[RankedCommit]
    unknown_confidence: float

    def to_dict(self) -> dict[str, object]:
        return {
            "incident_id": self.incident_id,
            "unknown_confidence": round(self.unknown_confidence, 4),
            "ranked_commits": [commit.to_dict() for commit in self.ranked_commits],
        }


class ServiceGraph:
    """Directed graph where edges are caller service -> dependency service."""

    def __init__(self, dependencies: Mapping[str, Iterable[str]]) -> None:
        normalized: dict[str, set[str]] = {
            service: set(deps) for service, deps in dependencies.items()
        }
        for deps in dependencies.values():
            for service in deps:
                normalized.setdefault(service, set())

        reverse: dict[str, set[str]] = {service: set() for service in normalized}
        for caller, deps in normalized.items():
            for dependency in deps:
                reverse.setdefault(dependency, set()).add(caller)
                reverse.setdefault(caller, set())

        undirected: dict[str, set[str]] = {service: set() for service in normalized}
        for service in normalized:
            undirected.setdefault(service, set()).update(normalized.get(service, set()))
            undirected.setdefault(service, set()).update(reverse.get(service, set()))

        self.dependencies = normalized
        self.reverse_dependencies = reverse
        self.undirected = undirected

    def evidence(
        self, deploy_service: str, signal_service: str, config: ScoringConfig
    ) -> GraphEvidence:
        if deploy_service == signal_service:
            return GraphEvidence("same_service", 0, 1.0)

        dependency_distance = self._shortest_path(
            start=signal_service,
            target=deploy_service,
            adjacency=self.dependencies,
            max_depth=config.max_graph_depth,
        )
        if dependency_distance is not None:
            return GraphEvidence(
                "changed_dependency_observed_by_caller",
                dependency_distance,
                config.dependency_decay**dependency_distance,
            )

        caller_distance = self._shortest_path(
            start=deploy_service,
            target=signal_service,
            adjacency=self.dependencies,
            max_depth=config.max_graph_depth,
        )
        if caller_distance is not None:
            return GraphEvidence(
                "changed_caller_or_traffic_source",
                caller_distance,
                config.caller_decay**caller_distance,
            )

        undirected_distance = self._shortest_path(
            start=deploy_service,
            target=signal_service,
            adjacency=self.undirected,
            max_depth=config.max_graph_depth,
        )
        if undirected_distance is not None:
            return GraphEvidence(
                "connected_without_direction",
                undirected_distance,
                config.undirected_decay**undirected_distance,
            )

        return GraphEvidence("unconnected", None, 0.03)

    @staticmethod
    def _shortest_path(
        start: str,
        target: str,
        adjacency: Mapping[str, Iterable[str]],
        max_depth: int,
    ) -> Optional[int]:
        if start == target:
            return 0

        queue: deque[tuple[str, int]] = deque([(start, 0)])
        seen = {start}
        while queue:
            service, distance = queue.popleft()
            if distance >= max_depth:
                continue
            for next_service in adjacency.get(service, ()):
                if next_service == target:
                    return distance + 1
                if next_service not in seen:
                    seen.add(next_service)
                    queue.append((next_service, distance + 1))
        return None


class IncidentAttributor:
    def __init__(self, graph: ServiceGraph, config: ScoringConfig | None = None) -> None:
        self.graph = graph
        self.config = config or ScoringConfig()

    def rank(self, incident: Incident, deploys: Sequence[DeployEvent]) -> AttributionResult:
        candidates = [deploy for deploy in deploys if self._is_candidate(deploy, incident)]
        if not candidates:
            return AttributionResult(
                incident_id=incident.incident_id,
                ranked_commits=[],
                unknown_confidence=1.0,
            )

        candidate_prior = (1.0 - self.config.unknown_prior) / len(candidates)
        scored: list[tuple[DeployEvent, float, Sequence[SignalContribution]]] = []

        for deploy in candidates:
            primary_graph = self.graph.evidence(
                deploy.service, incident.primary_service, self.config
            )
            primary_boost = 0.75 + (0.5 * primary_graph.factor)
            log_score = math.log(candidate_prior) + math.log(primary_boost)
            evidence = [self._score_signal(deploy, signal) for signal in incident.signals]
            log_score += sum(item.log_contribution for item in evidence)
            scored.append((deploy, log_score, evidence))

        unknown_log_score = math.log(self.config.unknown_prior)
        unknown_log_score += sum(
            (1.0 + _clamp(signal.severity, 0.0, 1.0))
            * math.log(self.config.unknown_signal_likelihood_ratio)
            for signal in incident.signals
        )
        denominator = _logsumexp([unknown_log_score, *[item[1] for item in scored]])
        ranked = [
            RankedCommit(
                deploy=deploy,
                confidence=math.exp(log_score - denominator),
                log_score=log_score,
                evidence=evidence,
            )
            for deploy, log_score, evidence in scored
        ]
        ranked.sort(key=lambda item: item.confidence, reverse=True)

        return AttributionResult(
            incident_id=incident.incident_id,
            ranked_commits=ranked,
            unknown_confidence=math.exp(unknown_log_score - denominator),
        )

    def _is_candidate(self, deploy: DeployEvent, incident: Incident) -> bool:
        skew_hours = self.config.clock_skew_minutes / 60.0
        timestamps = [signal.timestamp for signal in incident.signals] or [
            incident.started_at,
            incident.detected_at,
        ]
        return any(
            -skew_hours
            <= _hours_between(later=timestamp, earlier=deploy.deployed_at)
            <= self.config.max_delay_hours
            for timestamp in timestamps
        )

    def _score_signal(
        self, deploy: DeployEvent, signal: ObservabilitySignal
    ) -> SignalContribution:
        lag_hours = _hours_between(later=signal.timestamp, earlier=deploy.deployed_at)
        temporal = self._temporal_factor(lag_hours)
        graph = self.graph.evidence(deploy.service, signal.service, self.config)
        kind_weight = self.config.kind_weights.get(signal.kind, 0.5)
        severity = _clamp(signal.severity, 0.0, 1.0)

        explained = temporal * graph.factor * kind_weight * severity
        background = self.config.background_signal_probability
        likelihood_ratio = (background + ((1.0 - background) * explained)) / background
        log_contribution = (1.0 + severity) * math.log(max(likelihood_ratio, 1.0))

        return SignalContribution(
            signal_id=signal.signal_id,
            signal_service=signal.service,
            signal_kind=signal.kind.value,
            lag_hours=lag_hours,
            temporal_factor=temporal,
            graph_relationship=graph.relationship,
            graph_distance=graph.distance,
            graph_factor=graph.factor,
            likelihood_ratio=likelihood_ratio,
            log_contribution=log_contribution,
        )

    def _temporal_factor(self, lag_hours: float) -> float:
        skew_hours = self.config.clock_skew_minutes / 60.0
        if lag_hours < -skew_hours or lag_hours > self.config.max_delay_hours:
            return 0.0

        lag = max(0.0, lag_hours)
        immediate = math.exp(-lag / self.config.immediate_decay_hours)
        delayed = math.exp(-lag / self.config.delayed_decay_hours)
        return 0.55 * immediate + 0.45 * delayed


def simulate_incident() -> AttributionResult:
    def at(hour: int, minute: int) -> datetime:
        return datetime(2026, 5, 1, hour, minute, tzinfo=timezone.utc)

    graph = ServiceGraph(
        {
            "api-gateway": ["checkout", "identity", "search"],
            "checkout": ["payments", "inventory", "identity"],
            "payments": ["ledger"],
            "notifications": ["email"],
            "search": ["catalog"],
        }
    )

    deploys = [
        DeployEvent("dep-001", "a11ce01", "PR-231", "identity", at(10, 0)),
        DeployEvent("dep-002", "b00c042", "PR-232", "checkout", at(10, 4)),
        DeployEvent("dep-003", "cafe777", "PR-233", "payments", at(10, 20)),
        DeployEvent("dep-004", "deed404", "PR-234", "search", at(12, 45)),
        DeployEvent("dep-005", "ee11e55", "PR-235", "notifications", at(13, 0)),
    ]

    incident = Incident(
        incident_id="inc-2026-05-01-checkout-5xx",
        started_at=at(13, 18),
        detected_at=at(13, 24),
        primary_service="checkout",
        signals=[
            ObservabilitySignal(
                "sig-001",
                "checkout",
                at(13, 18),
                SignalKind.ERROR_RATE,
                0.96,
                "checkout 5xx rate jumped from 0.2% to 14%",
            ),
            ObservabilitySignal(
                "sig-002",
                "payments",
                at(13, 20),
                SignalKind.ERROR_RATE,
                0.92,
                "payments authorization errors increased after cache rollover",
            ),
            ObservabilitySignal(
                "sig-003",
                "api-gateway",
                at(13, 24),
                SignalKind.LATENCY,
                0.72,
                "p95 latency for checkout route exceeded alert threshold",
            ),
            ObservabilitySignal(
                "sig-004",
                "checkout",
                at(13, 25),
                SignalKind.ALERT,
                1.0,
                "PagerDuty alert for checkout availability",
            ),
        ],
    )

    return IncidentAttributor(graph).rank(incident, deploys)


def _hours_between(later: datetime, earlier: datetime) -> float:
    return (_as_utc(later) - _as_utc(earlier)).total_seconds() / 3600.0


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(value, upper))


def _logsumexp(values: Sequence[float]) -> float:
    peak = max(values)
    return peak + math.log(sum(math.exp(value - peak) for value in values))


if __name__ == "__main__":
    print(json.dumps(simulate_incident().to_dict(), indent=2))
