# Static Validation (snouty validate)

This step is the static analysis of the Kubernetes manifests using snouty.

## Local Analysis First

- Verify the manifests in `manifests/` to ensure that they are the complete functional system.
- This step is not complete until you can have completed a static analysis on the Kubernetes manifests and have validated using snouty.

## Run Snouty Validate

- Use `snouty validate /path/to/config-dir` to run the Antithesis Kubernetes validator. The path to the config directory should be `antithesis/config`. In essence it should have a folder called `manifests/` that contains all the Kubernetes manifests for the system. 
- Snouty validate runs the Kubernetes validator: `docker.io/antithesishq/k8s-validator` against the manifests provided in the config-dir.
- Any findings from the Kubernetes validator must be changed before submitting to Antithesis. The results from `snouty validate` should be implemented on the manifests. If there is not clarity on what to do, refer to `snouty docs` to the Kubernetes Best Practices page to figure out what changes need to be made to the manifest.

One major gotcha that is not completely accurate is that the **sum** of all CPU requests must be less than 1 and the **sum** of all memory requests must be less than 10 GiB across all pods that are deployed. The CPU restriction is to preserve determinism and the memory restriction is a hardware restriction. This means that if we have a single statefulset with 3 replicas, the spec of the statefulset should set the cpu requests to about 0.3 maximum if we want to evenly distribute the CPU across each pod. If we have multiple statefulsets and deployments, the sum of all of the cpu and memory across all deployed pods must be less than the requirements specified earlier.   

Be careful that when using custom operators, all of this could be arbitrary. Since the validator only does a static analysis of manifests, if we have a CustomResourceDefinition and associated CustomResources, violations will not be able to be caught by `snouty validate`. For these updates, based off of the rules from `snouty docs`, see if we are able to make a best effort guess at how the manifests are to be changed. If you are making any changes to Custom Resources, prompt the user for confirmation about whether to change them. Do not make any changes to CustomResourceDefinitions. 

Run a quick pass on the custom resources to see if there are any additional changes that are required to be made to get running in Antithesis. Before making edits, prompt the user to see if these are edits that we want to make. 

## Iteration Loop

Continue to run `snouty validate` and make the corresponding edits until there are no DENY results from snouty validates results. There may be warnings, and these warnings should be addressed, but it is up to the user if the manifests should be changed to fit with the warnings. 

## Inform the user

Inform the user the changes that we have made to the manifests. These are necessary to run in Antithesis, but the user should be aware of differences between their system in production and their system running in Antithesis.