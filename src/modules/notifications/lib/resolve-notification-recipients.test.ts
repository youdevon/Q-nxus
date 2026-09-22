import { describe, expect, it } from "vitest";

import {
  mergeNotificationRecipients,
  recipientsFromUsers,
  toNotificationRecipients,
} from "@/src/modules/notifications/lib/notification-recipient-mappers";

describe("toNotificationRecipients", () => {
  const users = [
    {
      id: "u1",
      email: "a@example.com",
      firstName: "Ada",
      lastName: "Admin",
    },
    {
      id: "u2",
      email: "b@example.com",
      firstName: "Bob",
      lastName: "Boss",
    },
  ];

  it("maps users and excludes actors", () => {
    const recipients = toNotificationRecipients(users, {
      excludeUserIds: ["u1"],
      sendEmail: false,
    });
    expect(recipients).toHaveLength(1);
    expect(recipients[0]?.userId).toBe("u2");
    expect(recipients[0]?.sendEmail).toBe(false);
    expect(recipients[0]?.name).toBe("Bob Boss");
  });

  it("returns empty when everyone excluded", () => {
    expect(
      toNotificationRecipients(users, { excludeUserIds: ["u1", "u2"] }),
    ).toEqual([]);
  });
});

describe("recipientsFromUsers", () => {
  it("skips inactive and null users", () => {
    const recipients = recipientsFromUsers([
      null,
      {
        id: "u1",
        email: "a@example.com",
        firstName: "Ada",
        lastName: "Admin",
        isActive: false,
      },
      {
        id: "u2",
        email: "b@example.com",
        firstName: "Bob",
        lastName: "Boss",
        isActive: true,
      },
    ]);
    expect(recipients).toHaveLength(1);
    expect(recipients[0]?.userId).toBe("u2");
  });
});

describe("mergeNotificationRecipients", () => {
  it("dedupes by userId with later entries winning", () => {
    const merged = mergeNotificationRecipients(
      [
        {
          userId: "u1",
          email: "old@example.com",
          name: "Old",
          sendEmail: false,
        },
      ],
      [
        {
          userId: "u1",
          email: "new@example.com",
          name: "New",
          sendEmail: true,
        },
        {
          userId: "u2",
          email: "b@example.com",
          name: "Bob",
          sendEmail: false,
        },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((row) => row.userId === "u1")?.email).toBe(
      "new@example.com",
    );
    expect(merged.find((row) => row.userId === "u1")?.sendEmail).toBe(true);
  });
});
