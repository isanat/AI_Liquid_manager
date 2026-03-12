#!/usr/bin/env bash
# Run this once after cloning to set up Foundry dependencies
set -e

if ! command -v forge &>/dev/null; then
  echo "Installing Foundry..."
  curl -L https://foundry.paradigm.xyz | bash
  source ~/.bashrc
  foundryup
fi

echo "Installing OpenZeppelin contracts..."
forge install OpenZeppelin/openzeppelin-contracts

echo "Building..."
forge build

echo "Done! Run: source ../.env && forge script script/Deploy.s.sol --rpc-url \$RPC_URL_ARBITRUM_SEPOLIA --broadcast"
