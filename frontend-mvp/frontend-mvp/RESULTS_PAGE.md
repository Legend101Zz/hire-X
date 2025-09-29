# Results Page Documentation

## Overview
The results page displays profile search results in a clean, organized table format with expandable details and shortlisting functionality.

## Features

### Table View
- **Preview Fields**: Shows essential information in a compact table format:
  - Rank
  - Name
  - Location
  - Current Role
  - Company
  - Industry
  - Seniority
  - Education

### Interactive Features
- **Expand/Collapse**: Click "Expand" to see all profile details in a detailed view
- **Shortlist**: Click "Shortlist" to mark profiles for further review
- **Responsive Design**: Works on desktop and mobile devices

### Color Scheme
- **Primary**: Violet (#7c3aed) for headers and accents
- **Secondary**: White backgrounds with violet highlights
- **Interactive**: Hover effects and state changes

## Usage

### Accessing Results
Navigate to `/results/[sessionId]` where `[sessionId]` is your search session identifier.

Example: `/results/demo-session`

### Demo Data
The page currently includes mock data for demonstration purposes. In production, this would be replaced with actual API calls to fetch real search results.

### API Integration
To connect with real data, update the `fetchResults` function in `/src/app/results/[sessionId]/page.tsx`:

```typescript
const response = await fetch(`/api/results/${sessionId}`);
const data = await response.json();
setProfiles(data.profiles);
```

## File Structure
```
src/
├── app/
│   ├── results/
│   │   └── [sessionId]/
│   │       └── page.tsx          # Results page component
│   └── layout.tsx                # Updated with navigation
├── components/
│   └── ui/
│       ├── results-table.tsx     # Main results table component
│       └── navigation.tsx        # Navigation component
└── app/
    └── globals.css               # Updated with violet color scheme
```

## Data Schema
The component expects profile data with the following structure (empty fields are automatically filtered out):

```typescript
interface Profile {
  first_name: string;
  last_name: string;
  title: string;
  location: string;
  country: string;
  seniority_level: string;
  current_industry: string;
  experience: Array<{...}>;
  education: Array<{...}>;
  linkedin_url: string;
  summary: string;
  expertise: string;
  functional_area: string;
  departments: string[];
  languages: string[];
  certifications: string[];
  publications: string[];
  patents: string[];
  awards: string[];
  memberships: string[];
  prior_industries: string[];
  // ... other fields
}
```

## Styling
The component uses Tailwind CSS with custom violet color variables defined in `globals.css`. The design is modern, clean, and follows the specified white and violet color scheme.
