# author: caitriona mccann
# date: 10/12/2025
# script to pull ollama model after first docker startup

Write-Host "Waiting for Ollama service to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

Write-Host "Pulling Llama 3.2 1B model..." -ForegroundColor Cyan
docker exec wearaware-ollama ollama pull llama3.2:1b

Write-Host "Model ready! Ollama is configured." -ForegroundColor Green
