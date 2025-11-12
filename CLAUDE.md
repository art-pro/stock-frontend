# CLAUDE.md

This file contains information for Claude Code to help with development tasks.

## Project Information
- **Type**: Stock Frontend Application
- **Framework**: Next.js 14.0.4 (React 18.2.0)
- **Language**: TypeScript 5.3.3

## Common Commands
- **Lint**: npm run lint
- **Type Check**: npx tsc --noEmit (inferred from TypeScript project)
- **Test**: [No test scripts found]
- **Build**: npm run build
- **Dev Server**: npm run dev

## Notes
- Current version: 1.3.2 (as of 2025-11-10)
- Recent features: JSON upload modal improvements, favicon addition, bulk stock updates API endpoint
- New feature: Ticker editing with duplicate detection and automatic merging

## Features Added
- **Ticker Editing**: Users can now edit stock ticker symbols with a dedicated modal
- **Duplicate Detection**: Automatically detects when a new ticker would create a duplicate
- **Smart Merging**: When duplicates are found, automatically merges stocks based on data completeness
  - The stock with more filled fields becomes the target (kept)
  - The stock with fewer filled fields becomes the source (merged and deleted)
  - Empty fields in the target are filled with data from the source
- **Visual Feedback**: Clear UI showing which stock will be kept and what data will be merged
- **Username Management**: Users can change their username from the Settings page with password verification