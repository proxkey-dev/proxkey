#!/usr/bin/env node

/**
 * Script to generate Open Graph images
 * Converts SVG to JPG for better compatibility with social media platforms
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Check if we have the required dependencies
async function checkDependencies() {
  try {
    await import('sharp')
    return true
  } catch {
    console.log('Installing sharp for image processing...')
    return false
  }
}

// Install sharp if not available
async function ensureDependencies() {
  if (!(await checkDependencies())) {
    try {
      execSync('npm install sharp --save-dev', { stdio: 'inherit' })
    } catch {
      console.error(
        'Failed to install sharp. Please install it manually: npm install sharp --save-dev',
      )
      process.exit(1)
    }
  }
}

async function generateOGImage() {
  await ensureDependencies()

  const svgPath = path.join(__dirname, '../public/og/cover-1200x630.svg')
  const jpgPath = path.join(__dirname, '../public/og/cover-1200x630.jpg')

  try {
    // Read SVG file
    const svgBuffer = fs.readFileSync(svgPath)

    // Import sharp dynamically
    const sharp = (await import('sharp')).default

    // Convert SVG to JPG
    await sharp(svgBuffer).resize(1200, 630).jpeg({ quality: 90 }).toFile(jpgPath)

    console.log('✅ Open Graph image generated successfully!')
    console.log(`📁 Location: ${jpgPath}`)

    // Update meta tags to use JPG instead of SVG
    updateMetaTags()
  } catch (error) {
    console.error('❌ Error generating Open Graph image:', error.message)
    process.exit(1)
  }
}

function updateMetaTags() {
  const filesToUpdate = ['../src/app/layout.tsx', '../index.html']

  filesToUpdate.forEach((filePath) => {
    const fullPath = path.join(__dirname, filePath)
    if (fs.existsSync(fullPath)) {
      let content = fs.readFileSync(fullPath, 'utf8')

      // Replace SVG references with JPG
      content = content.replace(/cover-1200x630\.svg/g, 'cover-1200x630.jpg')
      content = content.replace(/image\/svg\+xml/g, 'image/jpeg')

      fs.writeFileSync(fullPath, content)
      console.log(`📝 Updated meta tags in ${filePath}`)
    }
  })
}

// Run the script
generateOGImage().catch(console.error)
