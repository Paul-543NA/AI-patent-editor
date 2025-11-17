# Branch Naming Conventions

To maintain clarity and organization in our Git repository, please follow the naming conventions outlined below:

```
type/descriptive-branch-name
```

## Branch Prefixes

- **Feature Branches**: Use the `feature/` prefix for new features.
- Example: `feature/ai-autocomplete-step`

- **Bugfix Branches**: Use the `bugfix/` prefix for bug fixes.
- Example: `bugfix/webhook-issue`

- **Hotfix Branches**: Use the `hotfix/` prefix for urgent unclean/tinkered fixes.
- Example: `hotfix/urgent-fix`

## Guidelines

- Use lowercase letters for branch names.
- Separate words with hyphens (`-`) for readability.
- Ensure that branch names are descriptive to indicate the purpose of the branch.

# Commit Guidelines

To maintain a clear and organized project history, please adhere to the following commit guidelines when contributing to the repository:

## Commit Message Format

- Use the following structure for commit messages:

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
- `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation.
- `run`: Change in the run executions tracking file or in another file for the sole purpose of changing step run parameters.

- **Short Description**: Provide a concise summary of the changes (50 characters or fewer). It should be in imperative mode (eg. `Add AI autocomplete` rather than `Added AI autocomplete`).
- **Longer Description**: (Optional) Offer a detailed explanation of the commit, including the reasoning behind the change, how it was implemented, and any relevant information (wrap lines at 72 characters).

## Guidelines

- **Imperative Mood**: Write commit messages in the imperative mood (e.g., "Add feature").
- **Be Descriptive**: Ensure that commit messages clearly indicate the purpose of the change.
- **Reference Issues**: Reference relevant issue numbers or ticket IDs in the commit message (e.g., `Fixes #123`).
- **Limit Line Length**: Keep the line length to a maximum of 72 characters for better readability in various tools.

## Example Commit Messages

feat: add AI autocomplete in editor

Uses a websocket and the OpenAI API with GPT-12 to suggest awesome autocomplete for the editor.
Fixes #123

-------

By following these guidelines, we can maintain a clear and informative project history that facilitates collaboration and improves code quality.
