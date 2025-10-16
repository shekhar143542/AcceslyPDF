# Phase 3 Architecture Diagram

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│                    (ReportTab Component)                         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Fix Issue  │ │  🤖 Generate │ │ 🎨 Analyze   │
│    Button    │ │   Alt Text   │ │   Contrast   │
│  (Phase 2)   │ │  (Phase 3)   │ │  (Phase 3)   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       │                │                │
       ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────┐
│                     API LAYER                                 │
├──────────────────────────────────────────────────────────────┤
│  /api/checker/fix    /api/ai/          /api/ai/             │
│                      generate-alt-text  analyze-contrast     │
└───────┬──────────────────┬───────────────────┬──────────────┘
        │                  │                   │
        │                  │                   │
        ▼                  ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   pdf-lib    │  │  ai-service  │  │  ai-service  │
│   (Phase 2)  │  │    .ts       │  │    .ts       │
│              │  │  (Phase 3)   │  │  (Phase 3)   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
       │                 │                  │
       │           ┌─────┴──────┐           │
       │           │            │           │
       │           ▼            ▼           │
       │    ┌──────────┐ ┌──────────┐      │
       │    │  OpenAI  │ │  WCAG    │      │
       │    │  GPT-4   │ │ Formula  │      │
       │    │  Vision  │ │  (Local) │      │
       │    └──────────┘ └──────────┘      │
       │                                    │
       └────────────┬───────────────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │   Supabase Storage   │
        │   (PDF Files)        │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   Neon PostgreSQL    │
        │   (Metadata & Issues)│
        └──────────────────────┘
```

## 📊 Data Flow

### Alt Text Generation Flow
```
User Action
    ↓
Click "Generate Alt Text (AI)" Button
    ↓
Frontend validates (count image issues)
    ↓
Show cost estimate dialog
    ↓
User confirms
    ↓
POST /api/ai/generate-alt-text { pdfId }
    ↓
Backend downloads PDF from Supabase
    ↓
Extract images with pdf-parse
    ↓
Convert images to base64
    ↓
Call OpenAI GPT-4 Vision API (parallel)
    ↓
Receive alt text descriptions
    ↓
Update PDF metadata with pdf-lib
    ↓
Upload fixed PDF to Supabase
    ↓
Update database (mark issues as fixed)
    ↓
Calculate new accessibility score
    ↓
Return { success, altTexts[], cost, newScore }
    ↓
Frontend updates UI
    ↓
Show success message
    ↓
User downloads fixed PDF
```

### Contrast Analysis Flow
```
User Action
    ↓
Click "Analyze Contrast (AI)" Button
    ↓
Frontend validates (count contrast issues)
    ↓
User confirms
    ↓
POST /api/ai/analyze-contrast { pdfId }
    ↓
Backend fetches issues from database
    ↓
Extract color data from issues
    ↓
For each color pair:
    │
    ├─ Calculate relative luminance (sRGB)
    ├─ Compute contrast ratio formula
    ├─ Check AA compliance (4.5:1)
    ├─ Check AAA compliance (7:1)
    └─ Generate suggestions if failing
    ↓
Update PDF with adjusted colors (pdf-lib)
    ↓
Upload fixed PDF to Supabase
    ↓
Update database (mark issues as fixed)
    ↓
Calculate new accessibility score
    ↓
Return { success, analysis[], summary, newScore }
    ↓
Frontend updates UI
    ↓
Show AA/AAA failure counts
    ↓
User downloads fixed PDF
```

## 🔄 Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ReportTab.tsx                                              │
│  ├─ useState: issues, loading, isGeneratingAltText         │
│  ├─ useEffect: Poll for analysis completion                │
│  ├─ handleGenerateAltText(): Trigger AI alt text           │
│  ├─ handleAnalyzeContrast(): Trigger contrast analysis     │
│  └─ Render: AI buttons (conditional)                       │
│                                                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP Requests
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    BACKEND (Next.js API)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /api/ai/generate-alt-text/route.ts                        │
│  ├─ Download PDF from Supabase                             │
│  ├─ Call ai-service.generateAltText()                      │
│  ├─ Update PDF with pdf-lib                                │
│  ├─ Update database                                         │
│  └─ Return results                                          │
│                                                              │
│  /api/ai/analyze-contrast/route.ts                         │
│  ├─ Fetch color data from issues                           │
│  ├─ Call ai-service.analyzeColorContrast()                 │
│  ├─ Update PDF with pdf-lib                                │
│  ├─ Update database                                         │
│  └─ Return results                                          │
│                                                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                   AI SERVICE LAYER                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  src/lib/ai-service.ts                                      │
│  ├─ generateAltText(image, context)                        │
│  │   └─ OpenAI.chat.completions.create()                  │
│  │       ├─ Model: gpt-4-vision-preview                   │
│  │       ├─ System prompt: "Generate alt text <125 chars" │
│  │       └─ Return: descriptive text                      │
│  │                                                          │
│  ├─ analyzeColorContrast(fg, bg, fontSize)                │
│  │   ├─ Calculate luminance (sRGB formula)                │
│  │   ├─ Compute ratio: (L1 + 0.05) / (L2 + 0.05)         │
│  │   ├─ Check AA: 4.5:1 normal, 3:1 large                │
│  │   ├─ Check AAA: 7:1 normal, 4.5:1 large               │
│  │   └─ Return: { ratio, passes: {aa, aaa}, suggestion } │
│  │                                                          │
│  ├─ generateFormFieldLabels(fields, context)              │
│  ├─ detectTableStructure(tableData)                       │
│  ├─ batchGenerateAltText(images)                          │
│  └─ estimateAICost(type, count)                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 UI Component Structure

```
ReportTab Component
│
├─ Header Section
│  ├─ Accessibility Score (0-100%)
│  ├─ Score Bar (color-coded)
│  └─ Stats Grid
│     ├─ Total Issues
│     ├─ Fixed Issues
│     └─ Critical Issues
│
├─ Action Buttons Section
│  ├─ [Fix All Issues] (Phase 2)
│  │
│  └─ AI Features (Phase 3) - Conditional rendering
│     ├─ [🤖 Generate Alt Text (AI) - $X.XX]
│     │   • Shows only if: image/alt issues exist
│     │   • Gradient: purple to blue
│     │   • Icon: Sparkles (✨)
│     │   • Displays: cost estimate
│     │
│     └─ [🎨 Analyze Contrast (AI)]
│         • Shows only if: contrast/color issues exist
│         • Gradient: pink to orange
│         • Icon: Palette (🎨)
│         • Displays: no cost (free)
│
└─ Issues List Section
   └─ For each issue:
      ├─ Issue Card
      │  ├─ Icon (based on type)
      │  ├─ Description
      │  ├─ Severity Badge
      │  ├─ Page Number
      │  ├─ WCAG Reference
      │  │
      │  └─ Fix Status
      │     ├─ If fixed: Green background + checkmark
      │     ├─ If AI fixed: Green + "AI Generated" badge
      │     └─ If not fixed: [Fix Issue] button
      │
      └─ Loading state: Spinner + "Fixing issue..."
```

## 🔐 Security & Environment

```
.env.local
├─ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (Public)
├─ CLERK_SECRET_KEY (Secret)
├─ NEXT_PUBLIC_SUPABASE_URL (Public)
├─ SUPABASE_SERVICE_KEY (Secret)
├─ DATABASE_URL (Secret)
├─ PREP_API_ID (Secret)
├─ PREP_APP_KEY (Secret)
└─ OPENAI_API_KEY (Secret) ← NEW in Phase 3
   └─ Used by: ai-service.ts
   └─ Required for: Alt text generation, form labels
   └─ Cost: ~$0.02 per image
```

## 📦 Dependency Tree

```
Phase 3 Dependencies
│
├─ openai@6.3.0
│  ├─ Purpose: OpenAI API client
│  ├─ Used by: ai-service.ts
│  └─ Features: GPT-4 Vision, chat completions
│
├─ sharp@0.34.4
│  ├─ Purpose: Image processing
│  ├─ Used by: Image extraction (future)
│  └─ Features: Resize, convert, optimize
│
└─ pdf-parse@2.3.12
   ├─ Purpose: PDF parsing and extraction
   ├─ Used by: generate-alt-text API
   └─ Features: Text extraction, image extraction
```

## 🚀 Deployment Architecture

```
Production Environment
│
├─ Frontend (Vercel/Netlify)
│  ├─ Next.js 15.5.5
│  ├─ React 19.1.0
│  └─ Tailwind CSS 4
│
├─ API Routes (Edge Functions)
│  ├─ /api/checker/* (PREP integration)
│  ├─ /api/ai/generate-alt-text (GPT-4 Vision)
│  └─ /api/ai/analyze-contrast (WCAG)
│
├─ External Services
│  ├─ OpenAI API (GPT-4 Vision)
│  ├─ PREP Checker API (Accessibility)
│  ├─ Supabase Storage (PDF files)
│  └─ Neon PostgreSQL (Metadata)
│
└─ Environment Variables
   └─ Securely stored in platform config
```

## 🔄 State Management

```
React State Flow
│
├─ issues: Issue[]
│  └─ Fetched from: /api/checker/status
│  └─ Updated by: AI operations, fix operations
│
├─ loading: boolean
│  └─ True during: Initial fetch, polling
│
├─ isGeneratingAltText: boolean
│  └─ True during: AI alt text generation
│  └─ Controls: Button disabled state, spinner
│
├─ isAnalyzingContrast: boolean
│  └─ True during: Contrast analysis
│  └─ Controls: Button disabled state, spinner
│
└─ analysisStatus: string
   └─ Values: 'pending', 'in-progress', 'completed', 'failed'
   └─ Controls: UI rendering, polling
```

---

This architecture supports:
- ✅ Scalable AI operations
- ✅ Cost-effective processing
- ✅ Real-time user feedback
- ✅ Graceful error handling
- ✅ Conditional feature rendering
- ✅ Parallel API calls (future)
- ✅ Database consistency
- ✅ File versioning
