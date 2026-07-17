# FlintFlow Frontend

## Project Name
FlintFlow Frontend

## Tech Stack
- Next.js
- React
- TypeScript
- Tailwind CSS

## Folder Structure
- app/ - app router pages and layouts
- public/ - static assets
- src/ - frontend source files (if added later)

## Environment Variables
Use two files only:
- .env.example: shared template committed to the repo
- .env.local: your personal local environment file (not committed)

Copy the example file before running locally:
```bash
cp .env.example .env.local
```

## Development Guide
Coming soon.

## Docker Guide
### Build image
```bash
docker build -t flintflow-frontend .
```

### Run container
```bash
docker run -p 3000:3000 --env-file .env.local flintflow-frontend
```

### Port mapping
- Container port: 3000
- Host port: 3000

### Environment Variables
Use the values from .env.example or a real .env.local file when running the container.
