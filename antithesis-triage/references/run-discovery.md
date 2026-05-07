# Run Discovery

## How to obtain a list of runs on the tenant
```sh
snouty runs --json list -n 200 [OPTIONS]
```

Use `-n 200` as the default page size. Snouty's built-in default of 50 is often too small — it can miss the run when matching a triage-report URL (rule 3) or when looking for the oldest non-triaged run (rule 4). Bump higher (e.g. `-n 500` or `-n 1000`) if a search at 200 still doesn't find what the user is asking for.

You may use `snouty runs list --help` to see the other OPTIONS. The `--status` option is useful if you know the status — for instance, if you are searching for every completed run. Note that the status `failed` usually means the run failed to start for some reason and the failure can be triaged. The status `cancelled` may or may not be triageable — check `links.triage_report` in the run's JSON; if a report URL is present, a report was generated and you can proceed with triage. If `links` is null or `triage_report` is absent, no report exists.


## How to tell what run_id the user wants to use

Apply this rules, in order. 

1) The user may provide a run id directly -- if so, use that. Here is an example run_id: 

```
2c6fa5b630e543a92c98fbed4b555280-53-1
```
The format is <uuid>-<major antithesis version>-<minor version>

2) The user may ask for "the latest run" or "the run where we were trying <xxx>". Consult the runs list
from snouty if this is not in your memory. When a run is launched a run_id is returned so there is a good
chance you remembered this. You can also consider the description of the runs returned in the run list to identify
a run the user is asking for. Take into account the webhooks and sources you have been using with this user. See the notes below.

3) If the user provides a triage report URL, obtain a list of runs on the tenant as desbribed above. Match the
report URL provided by the user to the `links.triage_report` field in the json output and use the "run_id" field in the
same json object.

Here is an example report URL

https://<TENANT_ID>.antithesis.com/report/NtBhCs8sN0tN0F1kxoTQR0bo/WEdsk-2wXhfTiLlPLnXsCl7nnkPTxGv6dJJCpk01dQY.html?auth=<<AUTH_KEY>>

If you are unable to match the report URL, ask the user to supply the run_id directly, or use a web-page-visiting skill to extract it from the report page. The run_id is in the bottom section of the Triage Report. The web-page approach is slower and more error-prone, so prefer asking the user for the run_id when possible.

4) If the user did not provide an explicit triage report or run id use the oldest non-triaged run, if you know whether runs were triaged or not. If you do not know which runs have been triaged, use the most recently completed run.

### Notes

- When trying to intuit a run_id from the runs list, take into account the webhook and the source the user is using. Filter on these fields. If the user is using a non-default webhook or source this should be in your memory. For example, if you know your user is using a webhook "my_special_webhook", consider only runs in the runs list that use that webhook. This is because sometimes tenants are shared by different projects within the same customer.  Of course if the user asks you to go beyond just the one webhook or source, do that.

- Make sure NOT to filter by text or status unless explicitly asked. If you are trying to find the most recent run for a project, just look at recent runs with any status first. Only filter by text or status if you can't find what you are looking for.


