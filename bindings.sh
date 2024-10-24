#!/bin/bash

# Initialize an empty array to store bindings
bindings=()

# Read .env.local file line by line
while IFS='=' read -r name value || [[ -n "$name" ]]; do
    # Skip empty lines and comments
    [[ -z "$name" || "$name" =~ ^# ]] && continue

    # Trim leading and trailing whitespace from name and value
    name=$(echo "$name" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    value=$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

    # Remove surrounding quotes if present
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//')

    # Add to bindings array
    bindings+=("--binding" "${name}=${value}")
done < .env.local

# Join array elements with spaces and echo the result
echo "${bindings[@]}"
