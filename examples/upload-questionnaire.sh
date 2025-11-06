#!/bin/bash

# Script to upload a questionnaire to the API
# Usage: ./upload-questionnaire.sh

API_URL=${API_URL:-http://localhost:8080}

echo "Uploading questionnaire to $API_URL..."

curl -X POST "$API_URL/questionnaires" \
  -H "Content-Type: application/json" \
  -d '{
    "questionnaire": '"$(cat questionnaire-demo.json)"',
    "scoring": '"$(cat scoring-demo.json)"'
  }' | jq .

echo ""
echo "Done!"
