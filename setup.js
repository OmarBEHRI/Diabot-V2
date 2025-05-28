const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Helper function to execute commands
function runCommand(command, cwd) {
  try {
    console.log(`${colors.bright}${colors.cyan}Running: ${command}${colors.reset}`);
    execSync(command, { cwd, stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`${colors.bright}${colors.yellow}Error executing command: ${command}${colors.reset}`);
    console.error(error.message);
    return false;
  }
}

// Main setup function
async function setup() {
  console.log(`${colors.bright}${colors.magenta}=== Setting up Diabot Project ===${colors.reset}`);
  
  // Install backend dependencies
  console.log(`\n${colors.bright}${colors.blue}Installing backend dependencies...${colors.reset}`);
  if (!runCommand('npm install', path.join(__dirname, 'backend'))) {
    console.error(`${colors.bright}${colors.yellow}Failed to install backend dependencies. Exiting.${colors.reset}`);
    return;
  }
  
  // Install frontend dependencies
  console.log(`\n${colors.bright}${colors.blue}Installing frontend dependencies...${colors.reset}`);
  if (!runCommand('npm install', path.join(__dirname, 'frontend'))) {
    console.error(`${colors.bright}${colors.yellow}Failed to install frontend dependencies. Exiting.${colors.reset}`);
    return;
  }
  
  // Check if .env file exists, if not create it
  const envPath = path.join(__dirname, 'backend', '.env');
  if (!fs.existsSync(envPath)) {
    console.log(`\n${colors.bright}${colors.blue}Creating .env file...${colors.reset}`);
    const envContent = `PORT=3000
JWT_SECRET=diabot-secret-key
OPENROUTER_API_KEY=your_openrouter_api_key_here`;
    
    fs.writeFileSync(envPath, envContent);
    console.log(`${colors.bright}${colors.green}Created .env file at ${envPath}${colors.reset}`);
    console.log(`${colors.bright}${colors.yellow}IMPORTANT: Please edit the .env file and add your OpenRouter API key.${colors.reset}`);
  }
  
  console.log(`\n${colors.bright}${colors.green}Setup completed successfully!${colors.reset}`);
  console.log(`\n${colors.bright}${colors.magenta}=== How to run the application ===${colors.reset}`);
  console.log(`${colors.bright}1. Start the backend:${colors.reset}`);
  console.log(`   cd backend && npm start`);
  console.log(`${colors.bright}2. Start the frontend:${colors.reset}`);
  console.log(`   cd frontend && npm run dev`);
  console.log(`${colors.bright}3. Run benchmarks (optional):${colors.reset}`);
  console.log(`   cd backend && npm run benchmark`);
}

// Run the setup
setup().catch(error => {
  console.error(`${colors.bright}${colors.yellow}An error occurred during setup:${colors.reset}`, error);
});
