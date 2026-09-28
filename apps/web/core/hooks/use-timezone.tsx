/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";

// Inherited picker labels and identifiers; offsets come from the runtime IANA database.
const TIMEZONE_LOCATIONS = {
  "Pacific/Midway": "Midway Island",
  "Pacific/Pago_Pago": "American Samoa",
  "Pacific/Honolulu": "Hawaii",
  "America/Adak": "Aleutian Islands",
  "Pacific/Marquesas": "Marquesas Islands",
  "America/Anchorage": "Alaska",
  "Pacific/Gambier": "Gambier Islands",
  "America/Los_Angeles": "Pacific Time (US and Canada)",
  "America/Tijuana": "Baja California",
  "America/Denver": "Mountain Time (US and Canada)",
  "America/Phoenix": "Arizona",
  "America/Chihuahua": "Chihuahua, Mazatlan",
  "America/Chicago": "Central Time (US and Canada)",
  "America/Regina": "Saskatchewan",
  "America/Mexico_City": "Guadalajara, Mexico City, Monterrey",
  "America/Tegucigalpa": "Tegucigalpa, Honduras",
  "America/Costa_Rica": "Costa Rica",
  "America/New_York": "Eastern Time (US and Canada)",
  "America/Lima": "Lima",
  "America/Bogota": "Bogota",
  "America/Guayaquil": "Quito",
  "America/Cancun": "Chetumal",
  "America/Caracas": "Caracas, Caracas (Old Venezuela Time)",
  "America/Halifax": "Atlantic Time (Canada)",
  "America/Santiago": "Santiago",
  "America/La_Paz": "La Paz",
  "America/Manaus": "Manaus",
  "America/Guyana": "Georgetown",
  "Atlantic/Bermuda": "Bermuda",
  "America/St_Johns": "Newfoundland Time (Canada)",
  "America/Argentina/Buenos_Aires": "Buenos Aires",
  "America/Sao_Paulo": "Brasilia",
  "America/Godthab": "Greenland",
  "America/Montevideo": "Montevideo",
  "Atlantic/Stanley": "Falkland Islands",
  "Atlantic/South_Georgia": "South Georgia and the South Sandwich Islands",
  "Atlantic/Azores": "Azores",
  "Atlantic/Cape_Verde": "Cape Verde Islands",
  "Europe/Dublin": "Dublin",
  "Atlantic/Reykjavik": "Reykjavik",
  "Europe/Lisbon": "Lisbon",
  "Africa/Monrovia": "Monrovia",
  "Africa/Casablanca": "Casablanca",
  "Europe/Paris": "Central European Time (Berlin, Rome, Paris)",
  "Africa/Lagos": "Lagos, West Central Africa",
  "Africa/Algiers": "Algiers",
  "Africa/Tunis": "Tunis",
  "Europe/Kyiv": "Eastern European Time (Cairo, Helsinki, Kyiv)",
  "Europe/Athens": "Athens",
  "Asia/Jerusalem": "Jerusalem",
  "Africa/Johannesburg": "Johannesburg",
  "Africa/Harare": "Harare, Pretoria",
  "Europe/Moscow": "Moscow Time",
  "Asia/Baghdad": "Baghdad",
  "Africa/Nairobi": "Nairobi",
  "Asia/Riyadh": "Kuwait, Riyadh",
  "Asia/Tehran": "Tehran",
  "Asia/Dubai": "Abu Dhabi",
  "Asia/Baku": "Baku",
  "Asia/Yerevan": "Yerevan",
  "Europe/Astrakhan": "Astrakhan",
  "Asia/Tbilisi": "Tbilisi",
  "Indian/Mauritius": "Mauritius",
  "Asia/Kabul": "Kabul",
  "Asia/Karachi": "Islamabad, Karachi",
  "Asia/Tashkent": "Tashkent",
  "Asia/Yekaterinburg": "Yekaterinburg",
  "Indian/Maldives": "Maldives",
  "Indian/Chagos": "Chagos",
  "Asia/Kolkata": "Chennai, Kolkata, Mumbai, New Delhi",
  "Asia/Colombo": "Sri Jayawardenepura",
  "Asia/Kathmandu": "Kathmandu",
  "Asia/Dhaka": "Dhaka",
  "Asia/Almaty": "Almaty",
  "Asia/Bishkek": "Bishkek",
  "Asia/Thimphu": "Thimphu",
  "Asia/Yangon": "Yangon (Rangoon)",
  "Indian/Cocos": "Cocos Islands",
  "Asia/Bangkok": "Bangkok",
  "Asia/Ho_Chi_Minh": "Hanoi",
  "Asia/Jakarta": "Jakarta",
  "Asia/Novosibirsk": "Novosibirsk",
  "Asia/Krasnoyarsk": "Krasnoyarsk",
  "Asia/Shanghai": "Beijing",
  "Asia/Singapore": "Singapore",
  "Australia/Perth": "Perth",
  "Asia/Hong_Kong": "Hong Kong",
  "Asia/Ulaanbaatar": "Ulaanbaatar",
  "Pacific/Palau": "Palau",
  "Australia/Eucla": "Eucla",
  "Asia/Tokyo": "Tokyo",
  "Asia/Seoul": "Seoul",
  "Asia/Yakutsk": "Yakutsk",
  "Australia/Adelaide": "Adelaide",
  "Australia/Darwin": "Darwin",
  "Australia/Sydney": "Sydney",
  "Australia/Brisbane": "Brisbane",
  "Pacific/Guam": "Guam",
  "Asia/Vladivostok": "Vladivostok",
  "Pacific/Tahiti": "Tahiti",
  "Australia/Lord_Howe": "Lord Howe Island",
  "Pacific/Guadalcanal": "Solomon Islands",
  "Asia/Magadan": "Magadan",
  "Pacific/Norfolk": "Norfolk Island",
  "Pacific/Bougainville": "Bougainville Island",
  "Asia/Srednekolymsk": "Chokurdakh",
  "Pacific/Auckland": "Auckland, Wellington",
  "Pacific/Fiji": "Fiji Islands",
  "Asia/Anadyr": "Anadyr",
  "Pacific/Chatham": "Chatham Islands",
  "Pacific/Tongatapu": "Nuku'alofa",
  "Pacific/Apia": "Samoa",
  "Pacific/Kiritimati": "Kiritimati Island",
};

const useTimezone = () => {
  const timezones = useMemo(() => {
    const now = new Date();
    const locations = Object.entries(TIMEZONE_LOCATIONS).map(([value, label]) => {
      const utcOffset = new Intl.DateTimeFormat("en", { timeZone: value, timeZoneName: "longOffset" })
        .formatToParts(now)
        .filter((part) => part.type === "timeZoneName")
        .map((part) => part.value)
        .join("")
        .replace("GMT", "UTC")
        .replace(/^UTC$/, "UTC+00:00");
      return { value, label, utcOffset, offset: Number(utcOffset.slice(3).replace(":", "")) };
    });
    locations.sort((a, b) => a.offset - b.offset || a.label.localeCompare(b.label));
    return [
      ...locations.map(({ value, label, utcOffset }) => ({
        value,
        query: `${value} ${label}, ${utcOffset.replace("UTC", "GMT")}, ${utcOffset}`,
        content: (
          <div className="flex gap-1.5">
            <span className="text-placeholder">{utcOffset}</span>
            <span className="text-secondary">{label}</span>
          </div>
        ),
      })),
      { value: "UTC", query: "utc, coordinated universal time", content: "UTC" },
    ];
  }, []);
  return {
    timezones,
    selectedValue: (value: string | undefined) => timezones.find((option) => option.value === value)?.content,
  };
};

export default useTimezone;
