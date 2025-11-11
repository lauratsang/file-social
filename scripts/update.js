#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

console.log('🔄 Checking for file-social updates...\n')

// Check if this is tracking the upstream file-social repo
const isGitRepo = fs.existsSync(path.join(ROOT, '.git'))

if (isGitRepo) {
  try {
    // Check if they have the file-social remote
    const remotes = execSync('git remote -v', { encoding: 'utf8' })
    const hasFileSocialRemote = remotes.includes('cfreshman/file-social')
    
    if (hasFileSocialRemote) {
      const status = execSync('git status --porcelain', { encoding: 'utf8' })
      if (status.trim()) {
        console.log('⚠️  You have uncommitted changes.')
      }
      console.log('This is a git clone of file-social.\n')
      console.log('To update, run:')
      console.log('  git stash')
      console.log('  git pull origin main')
      console.log('  git stash pop\n')
      process.exit(0)
    }
    // Otherwise, they have their own git repo - continue with update
  } catch (e) {
    // Git command failed, continue with update
  }
}

console.log('📦 Downloading latest file-social...')

const GITHUB_ZIP = 'https://github.com/cfreshman/file-social/archive/refs/heads/main.zip'
const TEMP_DIR = path.join(ROOT, '.file-social-update')
const ZIP_FILE = path.join(TEMP_DIR, 'update.zip')

// Create temp directory
if (fs.existsSync(TEMP_DIR)) {
  fs.rmSync(TEMP_DIR, { recursive: true })
}
fs.mkdirSync(TEMP_DIR)

// Download zip
const file = fs.createWriteStream(ZIP_FILE)
https.get(GITHUB_ZIP, (response) => {
  response.pipe(file)
  file.on('finish', () => {
    file.close()
    console.log('✅ Downloaded\n')
    
    console.log('📂 Extracting...')
    
    // Extract zip
    try {
      execSync(`unzip -q "${ZIP_FILE}" -d "${TEMP_DIR}"`, { stdio: 'inherit' })
      
      const extractedDir = path.join(TEMP_DIR, 'file-social-main')
      
      console.log('✅ Extracted\n')
      console.log('🔄 Updating files...')
      
      // Files and directories to EXCLUDE (preserve user content)
      const exclude = new Set([
        'posts',
        'public/config',
        'public/data',
        '_01',
        'server/custom',
        'deploy/config.sh',
        'node_modules',
        '.git'
      ])
      
      // Copy everything except excluded paths
      function copyRecursive(src, dest, relativePath = '') {
        const items = fs.readdirSync(src)
        
        items.forEach(item => {
          const srcPath = path.join(src, item)
          const destPath = path.join(dest, item)
          const relPath = relativePath ? `${relativePath}/${item}` : item
          
          // Skip if this path is excluded
          if (exclude.has(relPath)) {
            return
          }
          
          const stat = fs.statSync(srcPath)
          
          if (stat.isDirectory()) {
            // Create directory if it doesn't exist
            if (!fs.existsSync(destPath)) {
              fs.mkdirSync(destPath, { recursive: true })
            }
            // Recurse into directory
            copyRecursive(srcPath, destPath, relPath)
          } else {
            // Copy file
            fs.copyFileSync(srcPath, destPath)
          }
        })
      }
      
      copyRecursive(extractedDir, ROOT)
      
      console.log('✅ Files updated\n')
      console.log('📦 Installing dependencies...')
      
      execSync('npm install', { cwd: ROOT, stdio: 'inherit' })
      
      console.log('\n✅ Update complete!')
      console.log('\nYour content was preserved:')
      console.log('  • posts/')
      console.log('  • public/config/')
      console.log('  • public/data/')
      console.log('  • server/custom/ (if it exists)')
      console.log('  • _01/')
      
      // Cleanup
      fs.rmSync(TEMP_DIR, { recursive: true })
      
    } catch (error) {
      console.error('❌ Update failed:', error.message)
      if (fs.existsSync(TEMP_DIR)) {
        fs.rmSync(TEMP_DIR, { recursive: true })
      }
      process.exit(1)
    }
  })
}).on('error', (err) => {
  console.error('❌ Download failed:', err.message)
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true })
  }
  process.exit(1)
})

