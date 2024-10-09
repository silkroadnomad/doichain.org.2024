#!/bin/bash

# Run the ipfs add command and capture the output
output=$(ipfs add -r public)

# Extract the CID using awk or cut
cid=$(echo "$output" | tail -n 1 | awk '{print $2}')

# Run the ipfs name publish command with the extracted CID
ipfs name publish --key=doichain.org $cid

# Update the vercel.json file with the new CID
sed -i '' "s|/ipfs/[^\"}]*|/ipfs/$cid|g" vercel.json

echo 'please commit vercel.json and push it to vercel!'