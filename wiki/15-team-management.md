# Team Management

Provenant supports multiple team members per organization with role-based access control.

---

## User Roles

| Role | Create/Edit | Delete | Invite | Change roles | Billing |
|------|-------------|--------|--------|--------------|---------|
| **OWNER** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ADMIN** | ✅ | ✅ | ✅ | Members only | ❌ |
| **MEMBER** | ✅ | Own items | ❌ | ❌ | ❌ |
| **VIEWER** | ❌ (read-only) | ❌ | ❌ | ❌ | ❌ |

- **OWNER** — full access; there must always be at least one OWNER per org
- **ADMIN** — manage the team and all resources; cannot change other admins or owners
- **MEMBER** — create and edit agents, suites, sessions; default role for new invitations
- **VIEWER** — read-only access to all resources; useful for stakeholders

---

## Viewing Team Members

Navigate to **Team** in the sidebar to see all active team members and pending invitations.

---

## Inviting a New Member

1. Click **Invite Member**
2. Enter the invitee's **email address**
3. Select a **role** (ADMIN / MEMBER / VIEWER)
4. Click **Send Invitation**
5. Copy the **invite link** from the green banner and share it with the invitee

> Invite links expire after **7 days**. Generate a new invitation if the link expires.

### What the invitee sees

When the invitee opens the invite link they will be prompted to:
- Enter their name and choose a password (if they don't have an account)
- Or sign in with their existing account (which will be migrated to your org)

After accepting, they appear in the **Team** table immediately.

---

## Changing a Member's Role

> Only **OWNER** users can change roles.

1. In the **Team** table, find the member
2. Use the **Role** dropdown to select the new role
3. The change takes effect immediately

---

## Removing a Member

1. Click the **Remove** button next to the member's row
2. Confirm the action

The member loses access immediately. Their created resources (agents, sessions, etc.) are retained and reassigned to the organization.

> You cannot remove yourself. Transfer ownership first if needed.

---

## Managing Pending Invitations

Pending invitations appear in the **Pending Invitations** section. You can:

- **Cancel** an invitation before it is accepted (the link becomes invalid)
- Re-invite the same email address at any time

---

## API Keys and Team Members

Each API key is tied to the user who created it and inherits their role. Removing a team member **does not** automatically revoke their API keys — you must revoke them manually from the **API Keys** page. See [Authentication & API Keys](14-authentication.md).

---

## Audit Log

All team management actions are recorded in the [Audit Log](12-audit-log.md):

- `team.member.invited`
- `team.invitation.accepted`
- `team.member.role_changed`
- `team.member.removed`
- `team.invitation.cancelled`
