# CLAUDE.md

This file contains information for Claude Code to help with development tasks.

## Project Information
- **Type**: Stock Frontend Application
- **Framework**: Next.js 16.0.7 (React 19.2.0)
- **Language**: TypeScript 5.7.2

## Common Commands
- **Lint**: npm run lint
- **Type Check**: npx tsc --noEmit (inferred from TypeScript project)
- **Test**: [No test scripts found]
- **Build**: npm run build
- **Dev Server**: npm run dev

## Notes
- Current version: 1.5.0 (as of 2025-12-04)
- Updated all dependencies to latest versions (Next.js 16.0.7, React 19.2.0, TypeScript 5.7.2)
- Now using Next.js 16 with Turbopack for faster development builds
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