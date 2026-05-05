#!/usr/bin/env node

/**
 * Production testing script for password reset functionality
 * Tests all aspects of the reset flow in a production-like environment
 */

import https from 'https'
import http from 'http'
import { URL } from 'url'

// Configuration
const CONFIG = {
  // Test URLs - update these for your production environment
  BASE_URL: process.env.TEST_BASE_URL || 'https://proxkey.dev',
  RESET_URL: process.env.TEST_RESET_URL || 'https://proxkey.dev/auth/reset',

  // Test credentials (use test accounts only!)
  TEST_EMAIL: process.env.TEST_EMAIL || 'test@example.com',

  // Test settings
  TIMEOUT: 10000, // 10 seconds
  RETRIES: 3,
}

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: [],
}

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
  console.log(`${prefix} [${timestamp}] ${message}`)
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'ProxKey-Production-Test/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...options.headers,
      },
      timeout: CONFIG.TIMEOUT,
    }

    const req = client.request(requestOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        })
      })
    })

    req.on('error', reject)
    req.on('timeout', () => reject(new Error('Request timeout')))
    req.end()
  })
}

// Test functions
async function testPageAccess() {
  log('Testing page accessibility...')

  try {
    const response = await makeRequest(CONFIG.RESET_URL)

    if (response.statusCode === 200) {
      if (response.body.includes('Reset Your Password')) {
        results.passed++
        results.tests.push({
          name: 'Page Access',
          status: 'PASS',
          details: 'Page loads successfully',
        })
        log('Page access test passed', 'success')
        return true
      } else {
        throw new Error('Page content does not match expected')
      }
    } else {
      throw new Error(`HTTP ${response.statusCode}`)
    }
  } catch (error) {
    results.failed++
    results.tests.push({ name: 'Page Access', status: 'FAIL', details: error.message })
    log(`Page access test failed: ${error.message}`, 'error')
    return false
  }
}

async function testSecurityHeaders() {
  log('Testing security headers...')

  try {
    const response = await makeRequest(CONFIG.RESET_URL)
    const headers = response.headers

    const requiredHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'content-security-policy',
    ]

    const missingHeaders = requiredHeaders.filter((header) => !headers[header])

    if (missingHeaders.length === 0) {
      results.passed++
      results.tests.push({
        name: 'Security Headers',
        status: 'PASS',
        details: 'All required headers present',
      })
      log('Security headers test passed', 'success')
      return true
    } else {
      throw new Error(`Missing headers: ${missingHeaders.join(', ')}`)
    }
  } catch (error) {
    results.failed++
    results.tests.push({ name: 'Security Headers', status: 'FAIL', details: error.message })
    log(`Security headers test failed: ${error.message}`, 'error')
    return false
  }
}

async function testInvalidLinkHandling() {
  log('Testing invalid link handling...')

  try {
    const invalidUrl = `${CONFIG.RESET_URL}?invalid=test`
    const response = await makeRequest(invalidUrl)

    if (response.statusCode === 200) {
      if (response.body.includes('Invalid or expired reset link')) {
        results.passed++
        results.tests.push({
          name: 'Invalid Link Handling',
          status: 'PASS',
          details: 'Proper error message shown',
        })
        log('Invalid link handling test passed', 'success')
        return true
      } else {
        throw new Error('Expected error message not found')
      }
    } else {
      throw new Error(`HTTP ${response.statusCode}`)
    }
  } catch (error) {
    results.failed++
    results.tests.push({ name: 'Invalid Link Handling', status: 'FAIL', details: error.message })
    log(`Invalid link handling test failed: ${error.message}`, 'error')
    return false
  }
}

async function testRedirectHandling() {
  log('Testing redirect handling...')

  try {
    const oldUrl = `${CONFIG.BASE_URL}/auth/reset-password.html`
    const response = await makeRequest(oldUrl, { maxRedirects: 0 })

    if (response.statusCode === 301 || response.statusCode === 302) {
      const location = response.headers.location
      if (location && location.includes('/auth/reset/')) {
        results.passed++
        results.tests.push({
          name: 'Redirect Handling',
          status: 'PASS',
          details: 'Old URLs redirect correctly',
        })
        log('Redirect handling test passed', 'success')
        return true
      } else {
        throw new Error('Redirect location incorrect')
      }
    } else {
      throw new Error(`Expected redirect, got HTTP ${response.statusCode}`)
    }
  } catch (error) {
    results.failed++
    results.tests.push({ name: 'Redirect Handling', status: 'FAIL', details: error.message })
    log(`Redirect handling test failed: ${error.message}`, 'error')
    return false
  }
}

async function testHealthCheck() {
  log('Testing health check endpoint...')

  try {
    const healthUrl = `${CONFIG.RESET_URL}/health.html`
    const response = await makeRequest(healthUrl)

    if (response.statusCode === 200 && response.body.includes('Status: OK')) {
      results.passed++
      results.tests.push({
        name: 'Health Check',
        status: 'PASS',
        details: 'Health check endpoint working',
      })
      log('Health check test passed', 'success')
      return true
    } else {
      throw new Error('Health check endpoint not working')
    }
  } catch (error) {
    results.failed++
    results.tests.push({ name: 'Health Check', status: 'FAIL', details: error.message })
    log(`Health check test failed: ${error.message}`, 'error')
    return false
  }
}

// Main test runner
async function runTests() {
  log('🚀 Starting production tests for password reset functionality...')
  log(`Testing URL: ${CONFIG.RESET_URL}`)
  log('')

  const tests = [
    testPageAccess,
    testSecurityHeaders,
    testInvalidLinkHandling,
    testRedirectHandling,
    testHealthCheck,
  ]

  for (const test of tests) {
    try {
      await test()
    } catch (error) {
      log(`Test error: ${error.message}`, 'error')
    }
    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  // Print results
  log('')
  log('📊 Test Results Summary:')
  log(`✅ Passed: ${results.passed}`)
  log(`❌ Failed: ${results.failed}`)
  log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`)
  log('')

  if (results.failed > 0) {
    log('❌ Failed Tests:')
    results.tests
      .filter((test) => test.status === 'FAIL')
      .forEach((test) => {
        log(`  - ${test.name}: ${test.details}`)
      })
    log('')
  }

  if (results.passed === results.tests.length) {
    log('🎉 All tests passed! Production deployment is ready.', 'success')
    process.exit(0)
  } else {
    log('⚠️  Some tests failed. Please review and fix before production deployment.', 'error')
    process.exit(1)
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch((error) => {
    log(`Fatal error: ${error.message}`, 'error')
    process.exit(1)
  })
}

export { runTests, testPageAccess, testSecurityHeaders }
