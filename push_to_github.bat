@echo off
echo Checking status...
git status

echo Adding changes...
git add .

set /p commit_msg="Enter commit message (default: Update): "
if "%commit_msg%"=="" set commit_msg=Update

echo Committing changes...
git commit -m "%commit_msg%"

echo Pushing to GitHub (https://github.com/dsavio83/myclass.git)...
git push origin main

echo Done!
pause
