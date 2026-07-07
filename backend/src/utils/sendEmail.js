// Simulated email sender for development/local execution
const sendEmail = async (options) => {
  console.log('\n========================================================================');
  console.log('✉️  [SIMULATED EMAIL SENT]  ✉️');
  console.log(`To:      ${options.email}`);
  console.log(`Subject: ${options.subject}`);
  console.log('------------------------------------------------------------------------');
  console.log(options.message);
  console.log('========================================================================\n');
  return true;
};

module.exports = sendEmail;
