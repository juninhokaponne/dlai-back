import { jest } from "@jest/globals";
import type { Request, Response } from "express";

export function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as Request;
}

export function mockResponse(): Response {
  const res = {} as Response;

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);

  return res;
}
