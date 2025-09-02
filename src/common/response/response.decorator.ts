// src/common/response/response.decorator.ts
import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels,ApiOkResponse, ApiBadRequestResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponse } from './response.dto';
/**
 * 统一成功返回格式
 * model 可以是单个 class，也可以是 class[]
 */
export function ApiOkResponseData<T extends Type<any>>(model: T) {
  return applyDecorators(
    ApiExtraModels(ApiResponse, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponse) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
}
/**
 * 统一错误返回格式
 */
export const ApiErrorResponse = () => {
  return applyDecorators(
    ApiBadRequestResponse({
      schema: {
        properties: {
          code: { type: 'number', example: 10001 },
          message: { type: 'string', example: '参数错误' },
          data: { type: 'null', example: null },
        },
      },
    }),
  );
};
