# HOD Login Issue - Complete Troubleshooting Guide

## Issue Summary

HOD users successfully login but redirect to `/unauthorized` instead of `/hod-review` dashboard.

## Root Cause

**Users do not get assigned any role when they register!** The role assignment must be done separately by an admin after account creation.

### How the System Works:

1. **User Registration** → Creates account with NO roles
2. **User Login** → If no roles, user defaults to EMPLOYEE
3. **Dashboard Access** → Protected routes check for specific roles (e.g., HOD dashboard needs "HOD" role)
4. **Unauthorized Redirect** → If role is missing, user is sent to `/unauthorized`

## Solution

### Step 1: Start the API Server

```bash
cd d:\web_all\hr_software
pnpm dev
# or
pnpm turbo dev --filter=api
```

### Step 2: Get Admin Access Token

1. Use the admin account from seed data: `admin@svgoi.local` / `password123`
2. Call login endpoint to get access token:
   ```bash
   POST http://localhost:3000/api/v1/auth/login
   Body: {
     "email": "admin@svgoi.local",
     "password": "password123"
   }
   ```

### Step 3: Get All Users (to find HOD user ID)

```bash
GET http://localhost:3000/api/v1/admin/users
Authorization: Bearer {ADMIN_ACCESS_TOKEN}
```

This will return all users with their current roles. Find the HOD user by email.

### Step 4: Assign HOD Role to User

**NEW ENDPOINT:** `POST /api/v1/admin/users/:userId/roles`

```bash
POST http://localhost:3000/api/v1/admin/users/{HOD_USER_ID}/roles
Authorization: Bearer {ADMIN_ACCESS_TOKEN}
Content-Type: application/json

Body: {
  "role": "HOD"
}
```

### Step 5: Verify Role Assignment

```bash
GET http://localhost:3000/api/v1/admin/users/{HOD_USER_ID}
Authorization: Bearer {ADMIN_ACCESS_TOKEN}
```

Should show the user with `roles: [{ role: "HOD" }]`

### Step 6: Test HOD Login

1. Logout from admin account
2. Login with HOD email
3. Should now redirect to `/hod-review` dashboard ✓

## Available Admin Role Management Endpoints

### 1. Assign Role to User

```
POST /api/v1/admin/users/:userId/roles
Authorization: Bearer {SUPER_ADMIN_TOKEN}

Body: {
  "role": "HOD" | "HR" | "FACULTY" | "EMPLOYEE" | "COMMITTEE" | "MANAGEMENT" | "SUPER_ADMIN"
}
```

### 2. Remove Role from User

```
DELETE /api/v1/admin/users/:userId/roles/:role
Authorization: Bearer {SUPER_ADMIN_TOKEN}

Example:
DELETE /api/v1/admin/users/abc123/roles/HOD
```

### 3. Get User with Roles

```
GET /api/v1/admin/users/:userId
Authorization: Bearer {SUPER_ADMIN_TOKEN}
```

### 4. Get All Users

```
GET /api/v1/admin/users
Authorization: Bearer {SUPER_ADMIN_TOKEN}
```

## Curl Examples

### Get admin token:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@svgoi.local","password":"password123"}'
```

### List all users:

```bash
curl -X GET http://localhost:3000/api/v1/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Assign HOD role:

```bash
curl -X POST http://localhost:3000/api/v1/admin/users/USER_ID/roles \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"HOD"}'
```

## Testing with Postman

1. **Import the collection** (if available)
2. **Set up environment variable**: `token` = access token
3. **Call POST** `/admin/users/:userId/roles` with role in body
4. **Login as HOD** and verify dashboard access

## Common Issues

### Issue: "User not found" (404)

- **Solution**: Make sure you're using the correct userId. Get it from `/admin/users` endpoint first.

### Issue: "User already has this role" (400)

- **Solution**: That user already has the role assigned. To change roles, remove the old one first, then assign the new one.

### Issue: "Insufficient role permissions" (403)

- **Solution**: Make sure you're using a SUPER_ADMIN account token, not a regular user token.

### Issue: "Invalid token" (401)

- **Solution**: Token may have expired. Get a fresh one by logging in again.

## File Changes Made

- **apps/api/src/routes/admin.ts** - Added 3 new endpoints:
  - `POST /admin/users/:userId/roles` - Assign role
  - `DELETE /admin/users/:userId/roles/:role` - Remove role
  - `GET /admin/users/:userId` - Get user with roles

No database schema changes needed - uses existing `UserRole` table.

## Expected Behavior After Fix

### Before Fix:

1. HOD register → Account created (no role)
2. HOD login → Success, but redirected to `/unauthorized`
3. Cannot access `/hod-review` dashboard

### After Fix:

1. HOD register → Account created (no role)
2. Admin assigns "HOD" role → User now has role in database
3. HOD login → Success, redirected to `/hod-review`
4. Can access HOD dashboard ✓

## Next Steps (Optional Improvements)

1. **Auto-assign roles during registration** - Accept role parameter in registration endpoint
2. **Create Role Management UI** - Build admin panel to manage user roles
3. **Set default roles** - Automatically assign FACULTY role to new registrations
4. **Role approval workflow** - Require admin approval for certain roles
