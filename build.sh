#!/bin/sh

echo "Beginning TSC compilation..."

tsc

# await user input (PAUSE)
read -n 1 -p "Press any key to continue..."
