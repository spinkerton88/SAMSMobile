#!/bin/bash

echo "Starting Store Directory Web Server..."
echo "Opening http://localhost:8000 in your browser..."
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start Python web server
python3 -m http.server 8000
