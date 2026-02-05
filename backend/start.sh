#!/bin/bash

# Startup script for Coordination Intelligence Platform
# Usage: ./start.sh [local|docker|ngrok]

set -e

MODE="${1:-local}"

echo "========================================"
echo "Coordination Intelligence Platform"
echo "Mode: $MODE"
echo "========================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env file and add your credentials"
    echo "   Required: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, OPENAI_API_KEY"
    exit 1
fi

case "$MODE" in
    local)
        echo "🚀 Starting in local mode..."
        echo "   Backend: http://localhost:8000"
        echo "   Frontend: http://localhost:3000"
        
        # Check Python environment
        if [ ! -d ".venv" ]; then
            echo "Creating virtual environment..."
            python3 -m venv .venv
        fi
        
        source .venv/bin/activate
        
        # Install dependencies
        echo "Installing dependencies..."
        pip install -e . > /dev/null 2>&1
        
        # Start backend
        echo "Starting backend server..."
        uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
        BACKEND_PID=$!
        
        # Wait for backend
        sleep 3
        
        # Check if backend is running
        if curl -s http://localhost:8000/health > /dev/null; then
            echo "✅ Backend is running!"
        else
            echo "❌ Backend failed to start"
            kill $BACKEND_PID 2>/dev/null || true
            exit 1
        fi
        
        echo ""
        echo "Backend is running at: http://localhost:8000"
        echo "Press Ctrl+C to stop"
        
        # Keep script running
        wait $BACKEND_PID
        ;;
        
    docker)
        echo "🐳 Starting with Docker..."
        
        # Check if docker is running
        if ! docker info > /dev/null 2>&1; then
            echo "❌ Docker is not running. Please start Docker first."
            exit 1
        fi
        
        # Build and start
        echo "Building and starting containers..."
        docker-compose down 2>/dev/null || true
        docker-compose up --build
        ;;
        
    ngrok)
        echo "🌍 Starting with ngrok (public URL)..."
        
        # Check if docker is running
        if ! docker info > /dev/null 2>&1; then
            echo "❌ Docker is not running. Please start Docker first."
            exit 1
        fi
        
        # Check ngrok authtoken
        if ! grep -q "NGROK_AUTHTOKEN=your-ngrok" .env && grep -q "NGROK_AUTHTOKEN=" .env; then
            echo "✅ Ngrok authtoken found"
        else
            echo "⚠️  Please set NGROK_AUTHTOKEN in .env file"
            echo "   Get it from: https://dashboard.ngrok.com/get-started/your-authtoken"
            exit 1
        fi
        
        echo "Building and starting containers with ngrok..."
        docker-compose down 2>/dev/null || true
        docker-compose --profile ngrok up --build
        ;;
        
    *)
        echo "Usage: ./start.sh [local|docker|ngrok]"
        echo ""
        echo "Modes:"
        echo "  local  - Run backend directly with Python (development)"
        echo "  docker - Run with Docker Compose (recommended)"
        echo "  ngrok  - Run with Docker + ngrok for public URL"
        echo ""
        exit 1
        ;;
esac
