# Making modifications to the files based on the specified design changes.

# Add this at the beginning of the file
file_contents = {}
for file_path in ["src/routes/+layout.svelte", "src/routes/+page.svelte", "src/routes/navigation.svelte"]:
    try:
        with open(file_path, 'r') as file:
            file_contents[file_path] = file.read()
    except FileNotFoundError:
        print(f"Warning: File not found - {file_path}")

# +layout.svelte modifications
layout_content = file_contents["src/routes/+layout.svelte"]
layout_updated_content = layout_content.replace(
    '<body class="bg-white text-gray-900 flex flex-col min-h-screen">',
    '<body class="bg-gray-50 text-gray-900 flex flex-col min-h-screen">'  # Soft gray background
)

# +page.svelte modifications
page_content = file_contents["src/routes/+page.svelte"]
page_updated_content = page_content.replace(
    'bg-blue-500 text-white',
    'bg-blue-400 text-white hover:bg-blue-500'  # Softer blue with hover effect
).replace(
    'bg-gray-800 text-white hover:bg-gray-700',
    'bg-gray-700 text-white hover:bg-gray-600'  # Dark gray for contrast with softer hover
).replace(
    'class="text-6xl font-medium mb-2 tracking-tight"',
    'class="text-6xl font-bold mb-4 tracking-tight"'  # Increase font weight and spacing for emphasis
).replace(
    'class="text-3xl font-mediumtext-gray-600 mb-12"',
    'class="text-3xl font-semibold text-gray-600 mb-12"'  # Increase readability of subtitle
).replace(
    'style="min-height: 100vh; {gradientStyle}"',
    'style="min-height: 100vh; background: linear-gradient(135deg, #E0F7FA, #B3E5FC, #0288D1);"'  # Softer gradient
)

# navigation.svelte modifications
navigation_content = file_contents["src/routes/navigation.svelte"]
navigation_updated_content = navigation_content.replace(
    'hover:bg-gray-200',
    'hover:bg-gray-300'  # Slightly darker hover for buttons
).replace(
    'font-size: 14px;',
    'font-size: 16px;'  # Larger font size for readability
)

# Saving the updated content back to the files
file_paths_modified = {
    "src/routes/+layout.svelte": layout_updated_content,
    "src/routes/+page.svelte": page_updated_content,
    "src/routes/navigation.svelte": navigation_updated_content
}

for path, content in file_paths_modified.items():
    with open(path, "w") as file:
        file.write(content)

file_paths_modified

