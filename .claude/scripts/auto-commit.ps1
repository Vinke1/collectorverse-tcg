# Auto-commit and push script for Claude Code hook
# This script commits and pushes changes after each Claude response

$repoPath = "C:\Users\vince\Desktop\Dev\CollectorVerse TCG"
Set-Location $repoPath

# Check if there are any changes
$status = git status --porcelain

if ($status) {
    # Get current timestamp for commit message
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    # Add all changes
    git add -A

    # Commit with timestamp
    $commitMessage = "Auto-save: $timestamp`n`nGenerated with Claude Code"
    git commit -m $commitMessage --no-verify 2>$null

    # Push to origin (silent, don't fail if offline)
    git push origin main --quiet 2>$null

    Write-Host "Changes committed and pushed at $timestamp"
} else {
    Write-Host "No changes to commit"
}
