// import tencentcloud from 'tencentcloud-sdk-nodejs';

const tencentcloud = require('tencentcloud-sdk-nodejs');

const SesClient = tencentcloud.ses.v20201002.Client;

const clientConfig = {
  credential: {
    secretId: process.env.MAIL_SECRET_ID,
    secretKey: process.env.MAIL_SECRET_KEY,
  },
  region: 'ap-hongkong',
  profile: {
    httpProfile: {
      endpoint: 'ses.tencentcloudapi.com',
    },
  },
};

// 实例化要请求产品的client对象,clientProfile是可选的
const client = new SesClient(clientConfig);

export async function sendVerifyCode(
  Destination: Array<string>,
): Promise<{ verifyCode: number }> {
  const VERIFICATION_CODE = Math.ceil(Math.random() * 1000000);

  // if (process.env.NODE_ENV === 'dev') {
  //   return {
  //     verifyCode: VERIFICATION_CODE,
  //   };
  // }

  await client.SendEmail({
    FromEmailAddress: 'xinxi@mail.sufu.site',
    Subject: '心栖注册验证码',
    Destination,
    // Simple: {
    //   Text: Buffer.from(`验证码是 ${VERIFICATION_CODE}`).toString('base64'),
    // },
    Template: {
      // 表示使用模板邮件格式
      TemplateID: 157879, // 从邮件推送控制台获取的模板ID
      TemplateData: JSON.stringify({
        PROJECT_NAME: '心栖',
        VERIFICATION_CODE,
      }),
    },
  });
  return {
    verifyCode: VERIFICATION_CODE,
  };
}
