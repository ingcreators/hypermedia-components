<!--
  Thanks for the contribution! See CONTRIBUTING.md for the project
  conventions. Keep this checklist intact in the final PR description.
-->

## Summary

<!-- One or two short bullets describing what changed and why. -->

-

## Test plan

<!-- How a reviewer can verify the change locally. Commands welcome. -->

- [ ] `pnpm -w run test`
- [ ] `pnpm -w run docs:build`
- [ ]

## Checklist

- [ ] I updated the docs (component or recipe page).
- [ ] I added or updated examples where relevant.
- [ ] I considered accessibility (native semantics, ARIA, contrast).
- [ ] I added tests where relevant (behaviors, token transform).
- [ ] I did not introduce a utility CSS framework as a requirement.
- [ ] I kept the implementation Light DOM first (no Shadow DOM).
- [ ] I updated `CHANGELOG.md` under **Unreleased** for any
      user-visible change.
