This directory contains files relevant to running tests in Antithesis.

**submit.sh**  
Use this script to submit Antithesis test runs.

**test.sh**  
Use this script to test the Antithesis harness locally.

**setup-complete.sh**  
Inject this script into a Dockerfile in order to notify Antithesis that setup is complete. This script should only run once the system under test is ready for testing to begin. Antithesis will not run any Test Composer Test Templates until it receives this event. You may forego this script in place of calling the setup complete method via the Antithesis SDK if it makes more sense for your system.

**config**
This directory contains the `docker-compose.yaml` file used to bring up this system within the Antithesis environment. It also contains a `Dockerfile` used to build a container image that only contains what Docker compose needs.

**notebook**  
This directory can be used as a working space for LLMs to think. Put any plans, notes, or TODOs relevant to Antithesis in this directory. Maintain this directory as you do Antithesis related work.

**test-composer**  
This directory should contain one or more Test Templates. A Test Template is a directory containing Test Command executable files. Each Test Command must have a valid Test Command prefix: `parallel_driver_, singleton_driver_, serial_driver_, first_, eventually_, finally_, anytime_`. Prefixes constrain when and how the Test Composer will compose different commands together in a single timeline.
