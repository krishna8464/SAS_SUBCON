# SAS_SUBCON QA Test Cases

## 1. Login & Session Flow

### TC-01: Login page loads correctly
- Navigate to `/user/login-page`
- Expected: page loads with the SAS_SUBCON login form, no access error banner
- Validation: input fields are visible and styled consistently

### TC-02: Invalid credentials are rejected
- Enter an unknown email/password
- Expected: a validation error appears and user remains on the login page
- Validation: no redirect to dashboard

### TC-03: Valid credentials redirect to correct dashboard
- Login with a valid user account
- Expected: token is stored and user is redirected to `/user/dashboard-view`
- Validation: no infinite redirect loop occurs

### TC-04: Stale token is cleared
- Insert an invalid/expired token in browser storage
- Expected: login screen loads cleanly and token is removed
- Validation: no access denied page loop

## 2. Role-Based Access Control

### TC-05: HO access
- Login as `HO`
- Expected: all admin modules are visible: Users, Sites, Suppliers, Designations, Report
- Validation: no hidden modules remain for this role

### TC-06: Developer access
- Login as `DEVELOPER`
- Expected: same access as HO, all admin modules available
- Validation: no visible restrictions beyond security rules

### TC-07: HSE access
- Login as `SITE_HSE`
- Expected: only HSE operational controls are visible; no Users, Sites, Suppliers, Designations buttons shown
- Validation: role-specific menu is hidden and protected routes remain blocked if accessed directly

### TC-08: Medic access
- Login as `SITE_MEDIC`
- Expected: medical review desk only, no HO/ERP admin modules visible
- Validation: navigation is limited to the reviewer workflow

### TC-09: Supplier access
- Login as `SUPPLIER`
- Expected: only supplier portal access is visible
- Validation: no admin menu or internal management buttons are rendered

### TC-10: Site manager access
- Login as `SITE_MANAGER`
- Expected: site-related controls are available, while admin-level modules remain hidden
- Validation: access rules match the role matrix

## 3. Page Layout & Visual Quality

### TC-11: Professional styling across main pages
- Open dashboard, login, management pages, and review pages
- Expected: consistent spacing, border radius, color system, typography, and section separation
- Validation: no odd spacing, broken cards, or inconsistent colors

### TC-12: Header branding alignment
- Check the top header across all pages
- Expected: branding is centered and aligned consistently
- Validation: no overlaps or broken wrapping on medium screens

### TC-13: Button hierarchy is clear
- Check each action button in all modules
- Expected: primary, secondary, and danger buttons are visually distinct
- Validation: CTA hierarchy is consistent and easy to follow

## 4. Responsive Layout Checks

### TC-14: Mobile viewport
- Reduce browser width to 375px
- Expected: content stacks vertically without overflow, no clipped cards, and buttons remain usable
- Validation: no horizontal scrolling on the main pages

### TC-15: Tablet viewport
- Test at 768px width
- Expected: tables wrap correctly and panels remain balanced.
- Validation: no collapsed rows or unreadable controls

### TC-16: Desktop viewport
- Open at 1280px or larger
- Expected: the dashboard and tables are aligned and use space efficiently
- Validation: cards, tables, and forms remain professional and readable

## 5. Review Workflow Checks

### TC-17: Medic/HSE queue loads correctly
- Open the medical or HSE review desk
- Expected: pending records render in proper tables with filters
- Validation: search, status tabs, and urgency filters all work

### TC-18: Resubmit status appears correctly
- Trigger a resubmit decision
- Expected: the request moves to correction state without breaking the queue
- Validation: the document remains accessible and status updates are visible

### TC-18A: Supplier remarks are captured on submission
- Create a new worker request and add a supplier remark
- Expected: the remark is stored with the request and shown on review screens or detail views
- Validation: no remark is lost during submission and no empty field breaks the form

### TC-19: HO approval details are visible
- Approve a request from the HO queue
- Expected: the approval summary appears in a structured detail panel, not an alert box
- Validation: employee, supplier, and approval information display neatly in the same format as the detail view

### TC-19A: HO sees all in-progress requests
- Log in as `HO` and inspect the queue before final clearance
- Expected: all supplier-submitted requests in active workflow appear, including requests still under review and not just those pending HO approval
- Validation: in-progress and completed categories are separated clearly

### TC-20: Final approval email content is readable
- Confirm the generated approval summary
- Expected: supplier email, employee data, status, and date are clearly presented
- Validation: content is readable and formatted consistently

## 6. Management Modules

### TC-21: User module access
- Open `/user/manage-users`
- Expected: only HO, ERP_TEAM, and DEVELOPER can manage users
- Validation: other roles redirect or receive denial

### TC-22: Site management access
- Open `/site/manage-sites`
- Expected: only permitted roles can access it
- Validation: no unauthorized role sees the page

### TC-23: Supplier management access
- Open `/supplier/manage-suppliers`
- Expected: only admin-level roles can view and manage supplier details
- Validation: supplier role does not get hidden internal admin options

### TC-24: Designation access
- Open `/designation/manage-designations`
- Expected: only permitted roles can access designation controls
- Validation: layout and buttons render correctly for each allowed role

## 7. Browser & Error Handling

### TC-25: Backend failure handling
- Force a backend error or invalid route
- Expected: the `not_available` page appears and the user is redirected back to login
- Validation: no broken page or blank white screen

### TC-26: Logout works for all roles
- Log out from dashboard and review pages
- Expected: token is cleared and user is returned to `/user/login-page`
- Validation: the app does not keep stale session state

### TC-26A: User profile is shown consistently on the dashboard
- Log in as HO, developer, supplier, or site user
- Expected: the user profile block shows name, email, and role in the top header area of the active dashboard
- Validation: it remains visible on all major pages and logout remains accessible

## 8. Acceptance Summary

The application passes QA if:
- every role sees only the modules that match its permissions
- headers and desk labels correctly reflect the logged-in role
- review and approval flows remain clear and consistent
- responsive layout remains stable across screen sizes
- final approval summary is readable in a detail-style panel rather than a browser popup
