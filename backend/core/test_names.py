import unittest

from core.names import full_name, identity_row, normalize_middle_name


class NameFormattingTests(unittest.TestCase):
    def test_absent_middle_names_are_blank(self):
        for value in (None, "", "  ", "N/A", " n/a ", "N / A", "NA", "N.A.", "Not Applicable"):
            with self.subTest(value=value):
                self.assertEqual(normalize_middle_name(value), "")
                self.assertEqual(full_name("Von Joshua", value, "Peje"), "Von Joshua Peje")

    def test_real_middle_names_are_preserved(self):
        for value in ("Mondalo", "N", "Naomi", "De la Cruz"):
            with self.subTest(value=value):
                self.assertEqual(normalize_middle_name(value), value)
                self.assertEqual(full_name("Mark Dave", value, "Panaguiton"), f"Mark Dave {value} Panaguiton")

    def test_api_identity_fields_are_normalized_without_changing_other_fields(self):
        columns = ["first_name", "middle_name", "last_name", "platform"]
        row = identity_row(columns, ["Von Joshua", "N/A", "Peje", "N/A"])
        self.assertEqual(row, {
            "first_name": "Von Joshua", "middle_name": "", "last_name": "Peje", "platform": "N/A",
        })
        self.assertEqual(" ".join(filter(None, [row[key] for key in columns[:3]])), "Von Joshua Peje")

    def test_non_identity_rows_are_unchanged(self):
        self.assertEqual(identity_row(["id", "content"], [1, "N/A"]), {"id": 1, "content": "N/A"})
