# Validate Locally

To validate that a Kubernetes setup is able to come up on a local Kubernetes cluster.

## Requirements

To perform this section, the user must have a Kubernetes cluster to test out the manifests that will be run in Antithesis. If the user does not have an active local Kubernetes cluster to test on, prompt the user to ask if they would like to download k3s and run a cluster locally.

## Permission to run commands

Ask the user before running any `kubectl`, `k3s`, `k3d`, or `kapp` commands.

## Identify the test cluster

Check to see if a user is running a local Kubernetes cluster. This could be a k3s, minikube, k3d, etc. cluster. It should have full access to the Kubernetes API Server. Ideally the user is using a k3s cluster locally (which is the same cluster than Antithesis uses), but if a user is using a Mac, they may be forced to use MiniKube or K3d. 

## Start up a local cluster

If the user is running Linux and does not have a test cluster ready to use, ask the user if they would like to spin one up. If the user agrees, spin up a local k3s cluster that mirrors what the Antithesis internal environment looks like. This is single-node K3s with CoreDNS + local-path-provisioner but no Traefik, ServiceLB, metrics-server, Flannel, or IPv6. The user can start a k3s cluster with `--disable traefik,servicelb,metrics-server`.

## Deploy the resources to the cluster

The next step is to deploy all of `manifests/` to the cluster to verify that the manifests are able to come up. As part of this, make sure to deploy all resources to a dedicated namespace so that anything else that is in the cluster is not polluting the antithesis system under test.

If `kapp` is available, use kapp to deploy the manifests to the cluster.

If `kapp` is not available, use `kubectl apply -f <manifests>` to create the resources in the cluster. CustomResourceDefinitions and Namespaces need to be applied first to the cluster because otherwise applies of other resources may fail. If applying CRDs and Namespaces, wait a few seconds until applying the remainder of the resources. 

## Verification

Local success != Success in Antithesis. While getting running locally on a k3s cluster is an excellent indicator of getting running in Antithesis, it is not guaranteed to mirror success in Antithesis. 

Additionally, certain things may not work in the local k3s cluster. While Antithesis requires `imagePullPolicy: Never` or `imagePullPolicy: IfNotPresent` without latest tags, if manifests have `Never` specified, then the pods may never come up. To resolve this, edit the pull policy to be `IfNotPresent` for the purpose of local testing.

Verify that all resources are able to come up successfully. What this means typically is that `kubectl get pods -n <namespace>` returns all the pods in a Running state with Ready statuses. Check the events in the namespace to see if there are any *Warnings*. While some of the Warnings may resolve with time, if anything persists, flag these as issues during local setup. For the resources that are not able to successfully run, inspect the resources deployed in the cluster to identify the problem.

If things that require persistent state(StatefulSets & PVCs) need to be edited to get to a Ready state, prefer to tear them down and re-apply rather than editing in flight. This is because a previous stale state might prevent resources from becoming ready in the future.  

## Tear Down

Make sure to clean up any Kubernetes resources that have been created before exiting.

If `kapp` was used to to create the manifests, use `kapp delete` to clean up the deployed application.

If `kubectl apply -f <manifests>` was used to create the resources in the cluster, use `kubectl delete -f <manifests>` to delete the resources from the cluster

If a k3s or k3d environment was created, make sure to delete it so that we do not leave lingering processes on the customer's machine.  