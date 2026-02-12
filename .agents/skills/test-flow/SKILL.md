---
name: test-flow
description: Standardized testing flows for the project.
---

# Test Flow

Use these commands to run tests and validate system behavior.

## 1. Automated Tests (Unit/Integration)

Run tests for the web application (where logic often resides).

- **Run All Tests**:
  ```bash
  cd apps/web
  npm run test
  ```
- **Watch Mode**:
  ```bash
  cd apps/web
  npx vitest
  ```

## 2. Manual Verification Checklist

When validating major features (Finance, Permissions):

### Finance System
1. **Add Debt**: Use `/debt add` (Bot) or Web UI to add debt to a test user.
2. **Repay**: Use `/pay` or Web UI to repay. **Verify** balance does not go positive (unless intended).
3. **Check Logs**: Verify transaction logs appeared in the customized channel.

### Permission System
1. **Sync Roles**: Run `/sync` in Discord.
2. **Check Access**: Verify user can/cannot access restricted web pages based on roles.
