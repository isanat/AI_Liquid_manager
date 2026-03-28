# Security Checklist - AI Liquid Manager

## ⚠️ CRITICAL: Credential Rotation Required

The following credentials were exposed in git history and **MUST be rotated immediately**:

### 1. KEEPER_PRIVATE_KEY (CRITICAL - Wallet Private Key)
```
Old (EXPOSED): 0x25591da6693f5fb1262d7736961881c4eab0aafe0d6ef672f120c4b78e5c8896
```

**Action Required:**
1. Create a NEW wallet for the keeper/strategy manager
2. Transfer any funds from the old wallet to the new wallet
3. Update `KEEPER_PRIVATE_KEY` in Coolify environment variables
4. Update any contracts that have the old address as authorized caller

### 2. THE_GRAPH_API_KEY
```
Old (EXPOSED): bb60df2c64bb3cfe2c8662b74bcb7276
```

**Action Required:**
1. Go to https://thegraph.com/studio/
2. Regenerate or create new API key
3. Update `THE_GRAPH_API_KEY` in Coolify environment variables

### 3. THE_GRAPH_API_KEY2
```
Old (EXPOSED): 4406f8139d6b9ab212d613efbd414988
```

**Action Required:**
1. Same as above - regenerate this key
2. Update `THE_GRAPH_API_KEY2` in Coolify environment variables

---

## Security Measures Implemented

### ✅ Completed
- [x] Removed `upload/AI_Liquid_manager.env` from git history
- [x] Enhanced `.gitignore` with patterns for sensitive files
- [x] Created pre-commit hook to prevent future secret commits
- [x] Deleted the exposed file from disk

### 🔄 Pending (User Action Required)
- [ ] Rotate `KEEPER_PRIVATE_KEY` (create new wallet, transfer funds)
- [ ] Rotate `THE_GRAPH_API_KEY`
- [ ] Rotate `THE_GRAPH_API_KEY2`
- [ ] Force push to remote repository (if applicable)

---

## Pre-commit Hook

A pre-commit hook has been created at `.git/hooks/pre-commit` that will:
- Block commits containing `.env` files
- Block commits containing private keys (0x... 64 hex chars)
- Block commits containing API key patterns
- Block commits with PEM private key blocks

To bypass (NOT RECOMMENDED):
```bash
git commit --no-verify
```

---

## Best Practices Going Forward

1. **Never commit `.env` files** - Use Coolify environment variables
2. **Use secrets management** - Coolify handles secrets securely
3. **Rotate credentials regularly** - Especially after any suspected exposure
4. **Review before committing** - Always check for sensitive data
5. **Use hardware wallets** - For production keeper wallets

---

## Support

If you need help with credential rotation or have security questions, please:
1. Check the Coolify dashboard at http://164.68.126.14:8000
2. Review environment variables under `ai-liquid-manager` → Environment Variables
3. Run new deployment after updating credentials
