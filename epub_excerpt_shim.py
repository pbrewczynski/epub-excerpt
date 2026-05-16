import subprocess
import sys
import os
from pathlib import Path

def main():
    # Check for node
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: 'node' is not installed or not in your PATH. This tool requires Node.js.")
        sys.exit(1)

    # Find the bundled Node.js CLI
    # When installed as a wheel, the files in 'include' are placed in the site-packages
    current_dir = Path(__file__).parent
    cli_path = current_dir / "dist" / "cli.cjs"
    
    # Fallback to current working directory (useful for local development)
    if not cli_path.exists():
        cli_path = Path(os.getcwd()) / "dist" / "cli.cjs"

    if not cli_path.exists():
         print(f"Error: Could not find Node.js CLI at {cli_path}")
         print("Make sure the project is built (npm run build) before installing via uv.")
         sys.exit(1)

    # Execute the Node.js CLI
    try:
        result = subprocess.run(["node", str(cli_path)] + sys.argv[1:])
        sys.exit(result.returncode)
    except KeyboardInterrupt:
        sys.exit(1)

if __name__ == "__main__":
    main()
