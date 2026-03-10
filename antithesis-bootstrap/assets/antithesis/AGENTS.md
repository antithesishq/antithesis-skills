This directory contains files relevant to running tests in Antithesis.

**submit.sh**  
Use this script to build and push any required images, then launch an Antithesis test run via `snouty run`.

**test.sh**  
Use this script to test the Antithesis harness locally.

**setup-complete.sh**
Inject this script into a Dockerfile in order to notify Antithesis that setup is complete. This script should only run once the system under test is ready for testing to begin. Antithesis will not run any Test Composer Test Templates until it receives this event. You may forego this script in place of calling the setup complete method via the Antithesis SDK if it makes more sense for your system.

**config**
This directory contains the `docker-compose.yaml` file used to bring up this system within the Antithesis environment.

**notebook**
This directory can be used as a working space for LLMs to think. Put any plans, notes, or TODOs relevant to Antithesis in this directory. Maintain this directory as you do Antithesis related work.

**Next step:** After bootstrap is complete, run the `antithesis-workload` skill to add a synthetic workload, test-composer commands, and Antithesis assertions.
