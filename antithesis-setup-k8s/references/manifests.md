# Rendering Manifests

How to write the `manifests/` folder.

## Goal

Create a collection of Kubernetes manifests based on the customer's manifests/helm chart/Kustomize templates. The result of this step is to create a directory of manifests that `horizontal-classification.md` and `vertical-classification.md` can minimize.

## Requirements

- Helm chart with values file or Kustomize templates or Kubernetes manifests must be provided

## Creation of raw manifests

### Helm Charts

If a helm chart is provided, there has to be an external values file also present. The values file should be outside of the helm chart, as the values file inside the helm chart is normally the default values that are provided to the chart. The values file that is provided could be in the shape of a FluxCD HelmRelease file or an ArgoCD Application or ApplicationSet file. Both of these have a values section and these should be used to render our the helm chart. If there is no external values, please ask the user for an external values file. If the user says to use the default values.yaml file in the helm chart, use that. 

Use `helm template <chart-name> <helm-chart-location>/ -n <namespace> --include-crds -f <values.yaml> > antithesis/config/manifests/manifests.yaml` to template the helm chart into the manifests folder. Using the `--include-crds` option will include any CustomResourceDefinitions if there are included. 

If helm template does not work because we are missing a required value, ask the user about what the possible new required value could be.

If the helm chart declares dependencies, resolve them to more manifests that will run alongside the SUT. Confirm with the user if these dependencies are required. 

### Kustomize

Use `kubectl kustomize <directory>` to create the kubernetes manifests that are using the kustomize framework. Also use Kustomize to set a namespace in the kustomization so that every resource has a namespace set.

### Namespace

If namespace is set for the Kubernetes resources that is not `default`, that namespace must also be created as part of the manifests. Antithesis only ships with the `default` namespace but it is recommended to deploy the SUT to its own namespace in the Antithesis cluster, so make sure the namespace is created with the manifests. Kapp will take care of the ordering of the apply's to ensure that all resources are created.

### Raw Manifests

If raw manifests are provided, simply move them over to the `manifests/` folder.

## Operators

If the customer is deploying a custom operator which will wrap their containers (e.g. managing a deployment or statefulset), then keep the operator and the custom resource that will be used, but do not try to unravel the operator's business code into a set of Kubernetes manifests.

# Updating image fields in manifests

Antithesis pre-pulls images into a local registry from either publicly accessible locations or the customer-facing Antithesis provided image registry. Therefore, it is best for the imagePullPolicy to be `Never` for the manifests to run in Antithesis. If the manifests point to the customer's internal registry, the manifests must be mutated to point at the Antithesis provided image registry. These can be detected by looking at Deployments, CronJobs, Jobs, StatefulSets, ReplicaSets, and Pods by looking at the `image` field on `containers[]`, `initContainers[]`, `ephemeralContainers[]`. This can be in the shape of `spec.template.` or `spec.template.spec.template`.

There is a gotcha here with custom resources. A user's collection of manifests may contain custom resources who's operator deploys pods (or a wrapper around pods) at runtime. If you are able to infer images that will be used in the resulting pods, also consider these images. If the images are not pushed up, the antithesis run will fail to bring up all the available resources that are managed by the custom resources (they should be in CrashLoopBackOff).

Create a list of the images in all the manifests. For each of these images, perform these steps:

1) If the image is a public image, inform the user that the image is a public image and that it will be accessible in Antithesis. 
2) If the image seems to be a private image in the customer's registry, ask the user if they have pushed this image to the Antithesis registry. The Antithesis registry should look the shape of: `us-central1-docker.pkg.dev/molten-verve-216720/<tenant-name>-repository/`. If the tenant name has a dash in it, a `p` will be appended after the dash. For example, `honey-whale` becomes `honey-pwhale`.
3) If the user has not already pushed the image to the Antithesis registry, prompt them to do so and then continue. 
