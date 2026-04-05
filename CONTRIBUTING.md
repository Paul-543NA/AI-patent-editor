# Branch Naming Conventions

```
type/descriptive-branch-name
```

## Branch Prefixes

- **Feature Branches**: Use the `feature/` prefix for new features.
  - Example: `feature/ai-autocomplete`

- **Bugfix Branches**: Use the `bugfix/` prefix for bug fixes.
  - Example: `bugfix/websocket-reconnect`

- **Hotfix Branches**: Use the `hotfix/` prefix for urgent fixes.
  - Example: `hotfix/api-key-validation`

## Guidelines

- Use lowercase letters for branch names.
- Separate words with hyphens (`-`) for readability.
- Ensure that branch names are descriptive.

# Commit Guidelines

## Commit Message Format

```
TYPE: Short description

Longer description (optional)
```

- **Type**: Indicate the type of change in the commit. Common types include:
  - `feat`: A new feature.
  - `fix`: A bug fix.
  - `docs`: Documentation only changes.
  - `style`: Changes that do not affect the meaning of the code (formatting, missing semi-colons, etc.).
  - `refactor`: A code change that neither fixes a bug nor adds a feature.
  - `test`: Adding missing tests or correcting existing tests.
  - `chore`: Changes to the build process or auxiliary tools and libraries.

- **Short Description**: Concise summary of the change (50 characters or fewer), written in imperative mood (e.g., `Add streaming JSON parser` not `Added streaming JSON parser`).
- **Longer Description**: (Optional) Detailed explanation including motivation and implementation notes (wrap at 72 characters).

## Guidelines

- **Imperative Mood**: Write commit messages in the imperative mood.
- **Be Descriptive**: Commit messages should clearly indicate the purpose of the change.
- **Limit Line Length**: Keep the line length to a maximum of 72 characters.

## Example Commit Messages

```
feat: add multi-strategy JSON recovery for streaming AI responses

The LLM review endpoint streams JSON over WebSocket, which can produce
malformed responses at chunk boundaries. This commit adds three fallback
parsing strategies applied in priority order.
```
