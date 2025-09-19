#!/bin/bash

echo "🔒 DAO Project Security Analysis"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create reports directory
mkdir -p reports

echo -e "\n${YELLOW}1. Compiling contracts...${NC}"
npx hardhat compile

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Compilation failed. Please fix compilation errors first.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}2. Running Slither static analysis...${NC}"
if command -v slither &> /dev/null; then
    slither . --json reports/slither-report.json --exclude-informational
    echo -e "${GREEN}✅ Slither analysis complete. Report saved to reports/slither-report.json${NC}"
else
    echo -e "${RED}❌ Slither not installed. Install with: pip3 install slither-analyzer${NC}"
fi

echo -e "\n${YELLOW}3. Running test coverage...${NC}"
npx hardhat coverage --temp temp-coverage
mv coverage.json reports/coverage.json 2>/dev/null
echo -e "${GREEN}✅ Coverage analysis complete. Report in reports/coverage.json${NC}"

echo -e "\n${YELLOW}4. Running gas analysis...${NC}"
REPORT_GAS=true npx hardhat test | tee reports/gas-report.txt
echo -e "${GREEN}✅ Gas analysis complete. Report saved to reports/gas-report.txt${NC}"

echo -e "\n${YELLOW}5. Manual security checklist:${NC}"
echo "📋 Review the following manually:"
echo "   • Access control modifiers on all functions"
echo "   • Reentrancy protection (ReentrancyGuard)"
echo "   • Integer overflow/underflow (use SafeMath if < 0.8.0)"
echo "   • Checks-Effects-Interactions pattern"
echo "   • External call safety"
echo "   • Input validation"
echo "   • Emergency pause mechanisms"

echo -e "\n${GREEN}🎉 Security analysis complete! Check the reports/ directory for detailed results.${NC}"