# Notifications and Alerts Domain Specification

## 1. Purpose

The Notifications and Alerts domain provides one centralized system for informing users about business events, assigned work, deadlines, warnings, failures and required actions.

It supports:

- In-app notifications

- Alert banners

- Task reminders

- Email notifications

- Future SMS notifications

- Future push notifications

- Escalations

- Read and unread status

- Delivery tracking

- Notification preferences

- Digest notifications

- Expiry and dismissal

- Failure alerts

- Security alerts

- Business-event notifications

Business domains determine what happened and whether a notification should be requested.

The Notifications domain determines:

- Who receives it

- Which channel is used

- When it is delivered

- How it is displayed

- Whether it should escalate

- Whether delivery succeeded

---

## 2. Domain Ownership

Primary owner:

- Notifications Domain

Shared consumers:

- Core Platform

- People

- Payroll

- Leave

- Recruitment

- Onboarding

- Offboarding

- Identity and Security

- Workflow

- Audit

- File Management

- Reporting

- Administration

- Future enterprise domains

Notifications owns:

- Notification

- Notification Template

- Notification Rule

- Notification Recipient

- Delivery Attempt

- Delivery Channel

- User Notification Preference

- Alert Banner

- Reminder

- Escalation Notification

- Notification Digest

- Notification History

Business domains retain ownership of the source record.

Examples:

- Leave owns the Leave Request.

- Workflow owns the Approval Task.

- Notifications owns the message informing the manager that approval is required.

---

## 3. Core Business Objects

The domain should include:

- Notification

- Notification Template

- Notification Template Version

- Notification Rule

- Notification Recipient

- Notification Preference

- Notification Delivery

- Delivery Attempt

- Delivery Channel

- Alert Banner

- Reminder Schedule

- Escalation Rule

- Notification Digest

- Notification Subscription

- Notification Exception

- Notification History

---

## 4. Notification

A Notification represents one message intended for one recipient or recipient group.

A Notification should contain:

### Identity

- Stable internal ID

- Organization ID

- Notification number

- Source domain

- Source event

- Source record type

- Source record ID

- Notification type

- Status

### Content

- Title

- Summary

- Body

- Action label

- Action link or route

- Icon reference

- Severity

- Category

- Confidentiality level

### Recipient

- Recipient user ID

- Recipient role, where applicable

- Recipient group, where applicable

- Recipient email, where external delivery is permitted

- Recipient organization

- Recipient scope

### Timing

- Created date

- Scheduled delivery date

- First delivered date

- Last delivery attempt

- Read date

- Acknowledged date

- Dismissed date

- Expiry date

### Governance

- Template ID

- Template version

- Correlation ID

- Created by service or user

- Priority

- Requires acknowledgement

- Escalation status

- Notes

---

## 5. Notification Types

Initial Notification types may include:

- Information

- Success

- Warning

- Error

- Action Required

- Reminder

- Approval Required

- Escalation

- Security Alert

- System Alert

- Deadline Alert

- Expiry Alert

- Completion Notice

- Delivery Failure

- Announcement

Notification type and severity should remain separate concepts.

---

## 6. Severity Levels

### Informational

General information with no urgent action required.

Examples:

- Record created

- Report ready

- Workflow completed

### Success

Confirms successful completion.

Examples:

- Leave Request approved

- Pay Run completed

- Document uploaded

### Warning

Attention is required, but the condition is not immediately blocking.

Examples:

- Contract expires in 60 days

- Task due soon

- Leave balance low

### High

Significant attention is required.

Examples:

- Payroll Profile incomplete before cut-off

- Access review overdue

- Onboarding at risk

### Critical

Immediate attention is required.

Examples:

- Pay Run failed

- Privileged access anomaly

- User deprovisioning failed

- Payroll payment file generation failed

Severity must influence presentation, escalation and delivery rules.

---

## 7. Notification Statuses

### Queued

The Notification has been created and awaits processing.

### Scheduled

Delivery is planned for a future date or time.

### Processing

The Notification service is preparing or delivering the message.

### Delivered

At least one configured delivery channel succeeded.

### Partially Delivered

Some channels or recipients succeeded while others failed.

### Delivery Failed

All required delivery attempts failed.

### Read

The recipient opened or viewed the Notification.

### Acknowledged

The recipient explicitly confirmed the Notification.

### Dismissed

The recipient removed the Notification from the active view.

### Expired

The Notification is no longer actionable.

### Cancelled

The Notification was cancelled before delivery.

### Archived

The Notification is retained for history.

---

## 8. Notification Categories

Initial categories may include:

- People

- Payroll

- Leave

- Recruitment

- Onboarding

- Offboarding

- Security

- Workflow

- Documents

- Administration

- System

- Reporting

- Procurement

- Assets

Categories should support filtering and user preferences.

---

## 9. Delivery Channels

Initial channels may include:

### In-App

Displayed inside Q-NXUS.

### Email

Delivered through an approved email provider.

### Alert Banner

Displayed prominently across one or more application areas.

### Task Inbox

Displayed as part of a user’s assigned workflow or operational tasks.

Future channels may include:

- SMS

- Mobile push notification

- Microsoft Teams

- Slack

- WhatsApp Business, where approved

- Voice notification

- External webhook

Channel support should be extensible.

---

## 10. In-App Notifications

In-app notifications should support:

- Notification bell

- Unread count

- Read and unread state

- Grouping

- Filtering

- Dismissal

- Action link

- Severity

- Timestamp

- Source module

- Pagination

- Mark all as read

- Bulk dismissal where permitted

Rules:

- Unread count must reflect the recipient’s actual unread Notifications.

- Opening a Notification may mark it read according to configured behavior.

- Reading does not automatically acknowledge a Notification.

- Dismissed Notifications remain available in history where required.

- Confidential content must not appear in an unauthorized user’s notification list.

---

## 11. Notification Bell

The application header should contain a notification bell.

The bell should display:

- Unread count

- New Notifications

- Severity indicator, where useful

- Recent Notifications

- Link to full Notification Centre

Rules:

- Count should update after read, dismissal or new delivery.

- Count should not include expired or inaccessible Notifications.

- The interface may update in real time through polling, server events or websockets.

- Failure to update the count must not block use of the application.

---

## 12. Toast Notifications

Toast Notifications provide brief feedback for immediate actions.

Examples:

- Record saved

- Task assigned

- File uploaded

- Error occurred

- Approval submitted

Rules:

- Toasts should appear temporarily and fade away.

- Toasts should not be the only record of an important business alert.

- Critical or actionable Notifications should also appear in the Notification Centre.

- Toasts must use clear, user-safe language.

- Repeated operations should not create excessive duplicate Toasts.

---

## 13. Alert Banners

An Alert Banner is a prominent message displayed across a defined application area.

Examples:

- Payroll processing unavailable

- Emergency organization announcement

- Scheduled system maintenance

- Data-security warning

- Policy acknowledgement required

- Major deadline approaching

A Banner should contain:

- Stable internal ID

- Organization ID

- Title

- Message

- Severity

- Start date

- End date

- Audience

- Placement

- Dismissal policy

- Acknowledgement requirement

- Action link

- Status

- Created by

- Approved by

---

## 14. Banner Audience

A Banner may target:

- All users

- One Organization

- One Department

- One Role

- One Pay Group

- One location

- Specific users

- Administrators

- Payroll users

- Managers

- Employees

Rules:

- Audience must be resolved securely.

- Users must not see Banners for unauthorized Organizations.

- Sensitive Banners must not reveal confidential information.

- Audience changes after publication must be audited.

---

## 15. Banner Placement

Possible placements:

- Global application header

- Dashboard

- Domain landing page

- Employee portal

- Payroll area

- Administration area

- Login page

- Specific record page

Rules:

- Critical global Banners should remain visible until dismissed or resolved.

- Informational Banners may be dismissible.

- Dismissal behavior should be configurable.

- Expired Banners must stop displaying automatically.

---

## 16. Notification Templates

A Notification Template defines reusable content.

A Template should contain:

- Stable internal ID

- Organization ID

- Template code

- Name

- Description

- Category

- Supported channels

- Title template

- Body template

- Action-label template

- Default severity

- Default priority

- Confidentiality level

- Status

- Version

- Effective dates

- Created date

- Updated date

Templates should support variables.

Example:

```text

Title:

Contract Expiring

Body:

{{employeeName}}'s contract expires on {{contractEndDate}}.