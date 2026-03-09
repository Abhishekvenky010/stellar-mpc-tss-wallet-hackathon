
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'wasm', 'pkg');
const targetDir = path.join(__dirname, 'public', 'wasm', 'pkg');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`Created directory: ${targetDir}`);
}

// Copy files
const files = fs.readdirSync(sourceDir);
files.forEach(file => {
  if (file === '.gitignore') {
    console.log(`Skipped: ${file}`);
    return;
  }
  
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  
  if (fs.lstatSync(sourcePath).isDirectory()) {
    // Recursively copy directories
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    const dirFiles = fs.readdirSync(sourcePath);
    dirFiles.forEach(dirFile => {
      if (dirFile !== '.gitignore') {
        fs.copyFileSync(path.join(sourcePath, dirFile), path.join(targetPath, dirFile));
        console.log(`Copied: ${path.join(file, dirFile)}`);
      } else {
        console.log(`Skipped: ${path.join(file, dirFile)}`);
      }
    });
  } else {
    // Copy files
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied: ${file}`);
  }
});

console.log('WebAssembly files copied successfully!');
