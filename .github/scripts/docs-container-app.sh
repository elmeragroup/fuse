#!/usr/bin/env bash
set -euo pipefail

# Called after azure/login in the target subscription. Infra owns environments and RBAC;
# this script owns the docs apps and revisions, including their first deployment.
mode="${1:?Usage: docs-container-app.sh prod|preview|teardown}"
: "${APP:?Set APP}"
: "${RESOURCE_GROUP:?Set RESOURCE_GROUP}"
case "$mode" in
  prod|preview) ;;
  teardown) : "${PR:?Set PR}" ;;
  *) echo "Unknown deployment mode: $mode" >&2; exit 1 ;;
esac

# A successful list with no match means absent. Auth, network and missing-RG errors fail
# the job instead of being mistaken for an app that needs creating.
find_app() {
  az containerapp list --resource-group "$RESOURCE_GROUP" \
    --query "[?name == '${APP}'].name" --output tsv --only-show-errors
}

retire_pr_revisions() {
  local keep="$1" revisions revision
  revisions=$(az containerapp revision list \
    --name "$APP" --resource-group "$RESOURCE_GROUP" \
    --query "[?properties.active].name" \
    --output tsv --only-show-errors)
  while IFS= read -r revision; do
    if [[ "$revision" == "${APP}--pr-${PR}-"* && "$revision" != "$keep" ]]; then
      az containerapp revision deactivate \
        --name "$APP" --resource-group "$RESOURCE_GROUP" --revision "$revision" \
        --output none --only-show-errors
    fi
  done <<< "$revisions"
}

existing=$(find_app)
if [[ "$mode" == teardown ]]; then
  if [[ -z "$existing" ]]; then
    echo "No preview app exists; nothing to remove."
    exit 0
  fi
  label=$(az containerapp show --name "$APP" --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.traffic[?label == 'pr-${PR}'].label" \
    --output tsv --only-show-errors)
  if [[ -n "$label" ]]; then
    az containerapp revision label remove \
      --name "$APP" --resource-group "$RESOURCE_GROUP" --label "pr-${PR}" \
      --output none --only-show-errors
  fi
  retire_pr_revisions ""
  exit 0
fi

: "${IMAGE:?Set IMAGE}"
: "${ENVIRONMENT:?Set ENVIRONMENT}"
: "${REGISTRY:?Set REGISTRY}"
: "${MANAGED_IDENTITY_ID:?Set MANAGED_IDENTITY_ID}"
: "${SUFFIX:?Set SUFFIX}"
revision_mode=single
min_replicas=1
create_suffix="$SUFFIX"
if [[ "$mode" == preview ]]; then
  : "${PR:?Set PR}"
  revision_mode=multiple
  min_replicas=0
  create_suffix=bootstrap
fi

created=false
if [[ -z "$existing" ]]; then
  if az containerapp create \
    --name "$APP" --resource-group "$RESOURCE_GROUP" \
    --environment "$ENVIRONMENT" --image "$IMAGE" \
    --user-assigned "$MANAGED_IDENTITY_ID" \
    --registry-server "${REGISTRY}.azurecr.io" --registry-identity "$MANAGED_IDENTITY_ID" \
    --ingress external --target-port 3000 \
    --revisions-mode "$revision_mode" --revision-suffix "$create_suffix" \
    --min-replicas "$min_replicas" --max-replicas 3 \
    --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 50 \
    --output none --only-show-errors; then
    created=true
  else
    status=$?
    # Another PR can create the shared app after our list. Only proceed if it now exists;
    # the original create error stays visible, and provisioning must settle before updating.
    existing=$(find_app)
    if [[ -z "$existing" ]]; then
      exit "$status"
    fi
  fi
fi

# A cancelled first run or a concurrent creator can leave provisioning in progress.
# Bound the wait to five minutes rather than updating an unfinished app.
for attempt in {1..30}; do
  state=$(az containerapp show --name "$APP" --resource-group "$RESOURCE_GROUP" \
    --query properties.provisioningState --output tsv --only-show-errors)
  case "$state" in
    Succeeded) break ;;
    InProgress|Updating|Waiting|Accepted)
      if [[ "$attempt" -eq 30 ]]; then
        echo "Timed out waiting for app provisioning." >&2
        exit 1
      fi
      sleep 10 ;;
    Failed|Canceled)
      # An existing app can retain a working revision after a failed rollout. Let an
      # update repair it, but do not publish a preview after our first creation failed.
      if [[ "$created" == true ]]; then
        echo "App provisioning did not succeed: $state" >&2
        exit 1
      fi
      break ;;
    *) echo "App provisioning did not succeed: $state" >&2; exit 1 ;;
  esac
done

if [[ "$mode" == preview ]]; then
  # Labels route independently of these weights. A permanent revision receives default
  # traffic, so replacing or closing a PR never removes the app's default traffic target.
  # Repeat this on redeploy to recover if the first run stopped before pinning traffic.
  az containerapp ingress traffic set \
    --name "$APP" --resource-group "$RESOURCE_GROUP" \
    --revision-weight "${APP}--bootstrap=100" --output none --only-show-errors
fi

# Production's create already deployed this suffix. Updating it again would reuse a name.
if [[ "$mode" == preview || "$created" == false ]]; then
  az containerapp update --name "$APP" --resource-group "$RESOURCE_GROUP" \
    --image "$IMAGE" --revision-suffix "$SUFFIX" --output none --only-show-errors
fi

if [[ "$mode" == preview ]]; then
  revision="${APP}--${SUFFIX}"
  az containerapp revision label add \
    --name "$APP" --resource-group "$RESOURCE_GROUP" \
    --revision "$revision" --label "pr-${PR}" --yes --output none --only-show-errors
  retire_pr_revisions "$revision"
  fqdn=$(az containerapp show --name "$APP" --resource-group "$RESOURCE_GROUP" \
    --query properties.configuration.ingress.fqdn --output tsv --only-show-errors)
  echo "url=https://${APP}---pr-${PR}.${fqdn#*.}" >> "${GITHUB_OUTPUT:?Set GITHUB_OUTPUT}"
  echo "revision=${revision}" >> "$GITHUB_OUTPUT"
fi
