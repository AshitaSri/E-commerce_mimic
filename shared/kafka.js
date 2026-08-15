const newrelic = require('newrelic');
const { Kafka, logLevel } = require('kafkajs');

function createClient(serviceName) {
  const brokers = (process.env.KAFKA_BROKER || 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim());

  const config = {
    clientId: serviceName,
    brokers,
    logLevel: logLevel.ERROR,
    retry: { retries: 8 },
  };

  // Hosted Kafka (e.g. Upstash) requires SASL/SSL auth; local Kafka has
  // none, so this only activates when credentials are actually provided.
  if (process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD) {
    config.ssl = true;
    config.sasl = {
      mechanism: process.env.KAFKA_SASL_MECHANISM || 'scram-sha-256',
      username: process.env.KAFKA_USERNAME,
      password: process.env.KAFKA_PASSWORD,
    };
  }

  return new Kafka(config);
}

let producer;

async function initProducer(serviceName) {
  const kafka = createClient(serviceName);
  producer = kafka.producer();
  await producer.connect();
  return producer;
}

async function publish(topic, message) {
  if (!producer) throw new Error('Producer not initialized — call initProducer(serviceName) first');
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }],
  });
}

// handler receives (topic, parsedMessage)
async function consume(serviceName, topics, groupId, handler) {
  const kafka = createClient(serviceName);
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const payload = JSON.parse(message.value.toString());
      // Kafka message handling isn't an HTTP request, so New Relic won't
      // track it automatically — wrap it in a background transaction so
      // this service shows up with real throughput/error data too.
      await newrelic.startBackgroundTransaction(`Kafka/${topic}`, 'Kafka', async () => {
        try {
          await handler(topic, payload);
        } catch (err) {
          newrelic.noticeError(err);
          throw err;
        } finally {
          newrelic.endTransaction();
        }
      });
    },
  });
  return consumer;
}

module.exports = { initProducer, publish, consume };
