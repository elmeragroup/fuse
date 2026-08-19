import { useColorScheme, useTheme } from "@elmeragroup/ui/theme";

export function App() {
  const theme = useTheme();
  const { colorScheme, resolvedColorScheme, setColorScheme } = useColorScheme();

  return (
    <main>
      <h1>Static theme fixture</h1>
      <p>Document brand {theme.brand}</p>
      <p>Color scheme preference {colorScheme}</p>
      <p>Resolved color scheme {resolvedColorScheme ?? "pending"}</p>
      <button type="button" onClick={() => setColorScheme("light")}>
        Use light color scheme
      </button>
      <button type="button" onClick={() => setColorScheme("dark")}>
        Use dark color scheme
      </button>
    </main>
  );
}
