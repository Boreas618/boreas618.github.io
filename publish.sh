#!/bin/bash

# Navigate to the os-notes directory
cd ./os-notes/

# Start the output list
echo "["

# Define a function to capitalize words as needed
capitalize() {
    echo "$1" | awk '{
        for(i=1;i<=NF;i++) {
            if (i != 1 && ($i == "and" || $i == "the" || $i == "in" || $i == "of" || $i == "to" || $i == "for" || $i == "on" || $i == "with" || $i == "at" || $i == "from" || $i == "by")) {
                printf("%s ", $i);
            } else {
                printf("%s%s ", toupper(substr($i, 1, 1)), tolower(substr($i, 2)));
            }
        }
        printf("\n");
    }'
}

# Loop through each .md file
find . -name "*.md" | while read -r file; do
    # Use sed to find and replace the img tag with centered img tag
    # This sed command looks for <img ... /> and wraps it with <center> tags
    # It handles additional attributes like alt and style
    # sed -i 's@<img [^>]*\/>@<center>&</center>@g' "$file"

    # Extract the name without the extension
    name=$(basename "$file" .md)

    # Replace hyphens with spaces
    formatted_name=$(echo $name | tr '-' ' ')

    # Capitalize appropriately
    title=$(capitalize "$formatted_name")

    # Print the list item, removing trailing spaces
    echo "  {text: '${title% }', link: '/os-notes/$name'},"
done

# End the output list
echo "]"

