import 'package:flutter/material.dart';

// Matches web index.css Figma tokens: #08080F base, #7B5DFF primary.
ThemeData corideTheme() {
  const base = Color(0xFF08080F);
  const card = Color(0xFF1E1E2E);
  const surface = Color(0xFF1A1A26);
  const primary = Color(0xFF7B5DFF);
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: base,
    colorScheme: ColorScheme.fromSeed(seedColor: primary, brightness: Brightness.dark).copyWith(
      surface: card,
      primary: primary,
    ),
    cardTheme: const CardThemeData(color: card, margin: EdgeInsets.zero),
    appBarTheme: const AppBarTheme(backgroundColor: base, foregroundColor: Colors.white, elevation: 0),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
    ),
  );
}
