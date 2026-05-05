export type DemoExample = {
  id: string
  label: string
  title: string
  rawText: string
  logs?: string
  source: 'support' | 'qa' | 'incident' | 'log' | 'other'
}

export type DashboardPreviewRow = {
  id: string
  title: string
  source: string
  severity: string
  owner: string
  confidence: string
  status: string
  action: string
  missing: string
  summary: string
  rawText: string
  evidence: string[]
  reproSteps: string[]
  missingContext: string[]
  nextAction: string
  exports: string[]
}

export const demoExamples: DemoExample[] = [
  {
    id: 'payment-checkout-bug',
    label: 'Payment checkout bug',
    title: 'Checkout crash after applying promo code',
    source: 'support',
    rawText:
      'Customer support says checkout is broken again. Two customers reported the app freezing right after they applied a discount and tapped Pay. One screenshot shows the Apple Pay sheet closing but the order never confirms. No browser version or session timestamp attached yet.',
    logs: 'POST /checkout/confirm 500 in 1643ms\npayment-provider timeout after confirmation callback\ntrace_id=pk_demo_checkout_timeout',
  },
  {
    id: 'login-session-bug',
    label: 'Login session bug',
    title: 'Users get bounced back to login after password reset',
    source: 'support',
    rawText:
      'QA and support both report that users can reset the password, but when they try to sign in again they immediately get redirected back to the login page. Mostly affecting Safari 17 and iOS web.',
    logs: 'session cookie set then cleared on /auth/callback\nSet-Cookie proxkey_session=...; SameSite=Lax\nGET /dashboard 302 /login',
  },
  {
    id: 'mobile-app-crash',
    label: 'Mobile app crash',
    title: 'Android app crashes on launch after 4.12.0 release',
    source: 'qa',
    rawText:
      'Launch regression found by QA. Android 14 devices crash immediately after splash screen in build 4.12.0. iOS unaffected. Customer complaints started 20 minutes after rollout.',
    logs: 'Fatal Exception: java.lang.NullPointerException\nat app.session.SessionStore.init(SessionStore.kt:88)',
  },
  {
    id: 'api-timeout-incident',
    label: 'API timeout incident',
    title: 'Bulk exports return 504 during business hours',
    source: 'incident',
    rawText:
      'Incident review note: /exports/bulk returns 504 when the request exceeds 5k rows. Retries sometimes succeed. Support attached three screenshots and a customer thread with repeated failures in US East.',
    logs: 'gateway timeout after 30000ms\nservice=exports-worker queue_depth=182\npostgres connection saturation warning',
  },
  {
    id: 'screenshot-only-complaint',
    label: 'Screenshot-only complaint',
    title: 'Customer says dashboard is blank after deploy',
    source: 'other',
    rawText:
      'Customer support forwarded a screenshot with the message "dashboard is blank after the update". No repro steps, no browser details, no account id yet.',
  },
]

export const dashboardPreviewRows: DashboardPreviewRow[] = [
  {
    id: 'payment-checkout-bug',
    title: 'Checkout spinner after Apple Pay',
    source: 'Support + logs',
    severity: 'SEV-1',
    owner: 'Billing',
    confidence: '94%',
    status: 'Ready',
    action: 'Open packet',
    missing: 'App version',
    summary: 'Users are stuck on a loading spinner after submitting Apple Pay during checkout.',
    rawText:
      'customer says checkout is broken\napp froze after discount\nApple Pay closed but spinner never stopped\nscreenshot_0426.png\nNo device info attached',
    evidence: ['4 support reports', '2 matching logs', '1 screenshot'],
    reproSteps: ['Open checkout', 'Apply promo code', 'Submit payment'],
    missingContext: ['Affected app version', 'Transaction timestamp'],
    nextAction: 'Assign to Billing and request affected session logs.',
    exports: ['GitHub', 'Jira', 'Linear', 'Markdown', 'Slack'],
  },
  {
    id: 'mobile-app-crash',
    title: 'Android 14 launch crash',
    source: 'QA + crash log',
    severity: 'SEV-1',
    owner: 'Mobile',
    confidence: '91%',
    status: 'Assigned',
    action: 'Open packet',
    missing: 'Build number',
    summary: 'Android 14 devices crash immediately after the splash screen on the latest release.',
    rawText:
      'app crashes sometimes\nreproduced by QA after login\nAndroid 14 only\nFatal Exception attached\nNo build number in ticket',
    evidence: ['1 QA report', '1 crash log', '3 customer complaints'],
    reproSteps: ['Launch app', 'Wait through splash screen', 'Observe crash before home renders'],
    missingContext: ['Build number', 'Affected device models'],
    nextAction: 'Assign to Mobile and request the rollout cohort plus affected device list.',
    exports: ['GitHub', 'Linear', 'Slack'],
  },
  {
    id: 'login-session-bug',
    title: 'Safari login redirect loop',
    source: 'Support thread',
    severity: 'SEV-2',
    owner: 'Auth',
    confidence: '88%',
    status: 'Needs review',
    action: 'Open packet',
    missing: 'Browser version',
    summary: 'Users authenticate successfully, then loop back to the login screen on Safari.',
    rawText:
      'customer says login is broken\npassword reset worked\nredirect loop starts after sign in\nSupport linked thread only\nNo Safari version attached',
    evidence: ['4 support reports', '2 matching logs', '1 recent deploy'],
    reproSteps: ['Reset password', 'Sign in again', 'Observe redirect back to login'],
    missingContext: ['Browser version', 'Session timestamp'],
    nextAction: 'Assign to Auth and request affected session logs plus Safari version.',
    exports: ['GitHub', 'Jira', 'Markdown'],
  },
  {
    id: 'api-timeout-incident',
    title: 'Bulk export 504 spike',
    source: 'Incident note + logs',
    severity: 'SEV-2',
    owner: 'Platform',
    confidence: '84%',
    status: 'Investigating',
    action: 'Open packet',
    missing: 'Retry pattern',
    summary: 'Bulk exports are timing out under large row counts during business hours in US East.',
    rawText:
      'incident channel says exports failing\n504 after 5k rows\nthree screenshots attached\nqueue depth rising\nNo retry timeline noted',
    evidence: ['3 screenshots', '2 logs', '1 incident thread'],
    reproSteps: ['Open bulk export', 'Request 5k+ rows', 'Observe 504 during daytime load'],
    missingContext: ['Retry timeline', 'Tenant IDs affected'],
    nextAction: 'Keep with Platform and compare queue saturation against recent deploy traffic.',
    exports: ['Linear', 'Slack', 'Markdown'],
  },
  {
    id: 'screenshot-only-complaint',
    title: 'Blank dashboard screenshot only',
    source: 'Screenshot',
    severity: 'SEV-3',
    owner: 'Frontend',
    confidence: '63%',
    status: 'Missing info',
    action: 'Request context',
    missing: 'Account ID',
    summary:
      'A screenshot suggests the dashboard is blank, but the report lacks enough context to route confidently.',
    rawText:
      'dashboard blank after deploy\nscreenshot_0426.png\nNo repro steps attached\nNo browser details\nNo account id',
    evidence: ['1 screenshot', '1 support forward'],
    reproSteps: ['Open dashboard after deploy', 'Observe blank state in screenshot only'],
    missingContext: ['Account ID', 'Browser details', 'Repro steps'],
    nextAction: 'Request account ID, browser details, and a short repro clip before assigning.',
    exports: ['Slack', 'Markdown'],
  },
]

export const liveSignalStrip = [
  'MESSY SIGNAL → PROXKEY TRIAGE → CLEAN HANDOFF',
  'PROMO FREEZE → P1 PACKET READY',
  'LOGIN LOOP → OWNER SUGGESTED',
  'ANDROID CRASH → REPRO STEPS GENERATED',
  'EXPORT SPIKE → DUPLICATE CLUSTERED',
  'BLANK DASHBOARD → MISSING CONTEXT DETECTED',
]

export const onboardingTypes = [
  'Bugs',
  'Incidents',
  'QA reports',
  'Support escalations',
  'Product feedback',
  'Release blockers',
]

export const onboardingTools = ['GitHub', 'Jira', 'Linear', 'Slack', 'Email', 'Notion', 'Other']
