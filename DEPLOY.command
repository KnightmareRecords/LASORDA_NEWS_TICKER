#!/bin/bash
# LASORDA Ticker - Publish update (Mac). Double-click to run.
cd "$(dirname "$0")" || exit 1
echo "Updating the database (if it asks \"continue?\", type y and press Enter)..."
if ! npm run db:migrate:remote; then
  echo
  echo "Database update failed - nothing was published. Send the text above to Claude."
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi
echo
echo "Publishing..."
if npm run deploy; then
  echo
  echo "Done. Changes are live in about a minute."
else
  echo
  echo "Publishing failed. Send the text above to Claude."
fi
read -n 1 -s -r -p "Press any key to close."
